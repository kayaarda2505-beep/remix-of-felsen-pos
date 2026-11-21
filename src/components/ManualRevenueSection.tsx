import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { localDate, REVENUE_SOURCES, revenuePayload, type RevenueSource } from "@/lib/finance-entries";

type Revenue = { id: string; revenue_date: string; amount: number; source: RevenueSource; note: string | null };
type Draft = { id?: string; revenue_date: string; amount: string; source: string; note: string };

export function ManualRevenueSection({ from, to, canManage }: { from: string; to: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [sourceFilter, setSourceFilter] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { data: entries = [], error, isPending } = useQuery({
    queryKey: ["manual_revenues", from, to],
    enabled: canManage,
    queryFn: async () => {
      const { data, error } = await supabase.from("manual_revenues")
        .select("id, revenue_date, amount, source, note").gte("revenue_date", from).lte("revenue_date", to)
        .order("revenue_date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Revenue[];
    },
  });
  const visible = entries.filter((e) => sourceFilter === "all" || e.source === sourceFilter);
  const total = visible.reduce((sum, e) => sum + Number(e.amount), 0);
  const save = useMutation({
    mutationFn: async (v: Draft) => {
      if (!canManage) throw new Error("Nur Administratoren und Manager dürfen Umsätze erfassen.");
      const payload = revenuePayload(v);
      const request = v.id
        ? supabase.from("manual_revenues").update(payload).eq("id", v.id)
        : supabase.from("manual_revenues").insert(payload);
      const { error } = await request;
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["manual_revenues"] });
      setDraft(null);
      setFormError(null);
      toast.success("Umsatz gespeichert");
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : "Umsatz konnte nicht gespeichert werden."),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      if (!canManage) throw new Error("Keine Berechtigung");
      const { error } = await supabase.from("manual_revenues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manual_revenues"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen"),
  });
  const open = (v: Draft) => { setFormError(null); setDraft(v); };

  return (
    <section aria-labelledby="manual-revenue-heading" className="mb-8 border-b border-border pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 id="manual-revenue-heading" className="text-lg font-semibold flex items-center gap-2"><Banknote className="size-5 text-accent" />Manuelle Umsätze</h2>
        <Button disabled={!canManage} onClick={() => open({ revenue_date: localDate(new Date()), amount: "", source: "", note: "" })}><Plus />Umsatz erfassen</Button>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div className="space-y-1.5 w-full sm:w-64">
          <label htmlFor="revenue-filter" className="text-xs text-muted-foreground">Umsatzherkunft filtern</label>
          <select id="revenue-filter" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm">
            <option value="all">Alle Umsatzherkünfte</option>
            {REVENUE_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="text-right"><div className="text-xs text-muted-foreground">Manuell erfasster Umsatz · {visible.length} Einträge</div><div className="text-2xl font-semibold tabular-nums">{total.toFixed(2)} CHF</div></div>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">Umsätze konnten nicht geladen werden: {error.message}</p> : canManage && isPending ? <Loader2 className="size-5 animate-spin" /> : visible.length === 0 ? <p className="py-5 text-sm text-muted-foreground">Keine manuellen Umsätze in dieser Auswahl.</p> : (
        <div className="divide-y divide-border">
          {visible.map((e) => <div key={e.id} className="flex items-center gap-3 py-3">
            <div className="flex-1 min-w-0"><div className="text-sm font-medium">{REVENUE_SOURCES.find((s) => s.value === e.source)?.label ?? e.source}</div><div className="text-xs text-muted-foreground">{new Date(`${e.revenue_date}T12:00:00`).toLocaleDateString("de-CH")}</div>{e.note && <p className="text-sm text-muted-foreground break-words">{e.note}</p>}</div>
            <span className="font-semibold tabular-nums whitespace-nowrap">{Number(e.amount).toFixed(2)} CHF</span>
            <Button variant="ghost" size="icon" disabled={!canManage} aria-label="Umsatz bearbeiten" title="Umsatz bearbeiten" onClick={() => open({ id: e.id, revenue_date: e.revenue_date, amount: String(e.amount), source: e.source, note: e.note ?? "" })}><Pencil /></Button>
            <Button variant="ghost" size="icon" className="text-destructive" disabled={!canManage || del.isPending} aria-label="Umsatz löschen" title="Umsatz löschen" onClick={() => { if (window.confirm("Diesen manuellen Umsatz löschen?")) del.mutate(e.id); }}><Trash2 /></Button>
          </div>)}
        </div>
      )}
      {draft && <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="revenue-editor-title" className="bg-background border border-border rounded-lg p-5 w-full max-w-lg max-h-[90dvh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5"><h3 id="revenue-editor-title" className="text-lg font-semibold">{draft.id ? "Umsatz bearbeiten" : "Umsatz erfassen"}</h3><Button variant="ghost" size="icon" aria-label="Schliessen" disabled={save.isPending} onClick={() => setDraft(null)}><X /></Button></div>
          <form onSubmit={(e) => { e.preventDefault(); setFormError(null); save.mutate(draft); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><label htmlFor="revenue-date" className="text-xs text-muted-foreground">Datum</label><input id="revenue-date" type="date" required value={draft.revenue_date} onChange={(e) => setDraft({ ...draft, revenue_date: e.target.value })} className="w-full min-w-0 bg-background border border-input rounded-md px-3 py-2 text-sm" /></div>
              <div className="space-y-1.5"><label htmlFor="revenue-amount" className="text-xs text-muted-foreground">Betrag (CHF)</label><input id="revenue-amount" inputMode="decimal" required value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} className="w-full min-w-0 bg-background border border-input rounded-md px-3 py-2 text-sm tabular-nums" autoFocus /></div>
            </div>
            <div className="space-y-1.5"><label htmlFor="revenue-source" className="text-xs text-muted-foreground">Umsatzherkunft</label><select id="revenue-source" required value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"><option value="" disabled>Herkunft auswählen</option>{REVENUE_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
            <div className="space-y-1.5"><label htmlFor="revenue-note" className="text-xs text-muted-foreground">Notiz (optional)</label><textarea id="revenue-note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} rows={2} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm" /></div>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <Button type="submit" className="w-full" disabled={!canManage || save.isPending}>{save.isPending && <Loader2 className="animate-spin" />}Speichern</Button>
          </form>
        </div>
      </div>}
    </section>
  );
}