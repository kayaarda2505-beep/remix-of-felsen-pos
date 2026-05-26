import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import {
  Camera, Upload, Trash2, Loader2, X, Receipt, Sparkles, ChevronLeft, ChevronRight, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { extractReceipt, type ExtractedExpense } from "@/lib/expenses-ai.functions";

export const Route = createFileRoute("/expenses")({
  head: () => ({ meta: [{ title: "Ausgaben — SAINTS POS" }] }),
  component: ExpensesPage,
});

type Expense = {
  id: string;
  expense_date: string;
  amount: number;
  currency: string;
  category: string;
  vendor: string | null;
  description: string | null;
  receipt_url: string | null;
  vat_amount: number | null;
  payment_method: string | null;
};

const CATEGORIES = [
  "Wareneinkauf", "Getränke", "Lebensmittel", "Reinigung", "Reparatur",
  "Miete", "Strom/Wasser", "Marketing", "Büro", "Transport", "Personal", "Sonstiges",
];

function ExpensesPage() {
  const qc = useQueryClient();
  const { operator } = useAuth();
  const isManager = operator?.role === "manager";
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [editor, setEditor] = useState<Partial<Expense> | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const monthEnd = useMemo(() => {
    const d = new Date(monthStart); d.setMonth(d.getMonth() + 1); d.setDate(0); return d;
  }, [monthStart]);

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["expenses", monthStart.toISOString().slice(0, 7)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, expense_date, amount, currency, category, vendor, description, receipt_url, vat_amount, payment_method")
        .gte("expense_date", monthStart.toISOString().slice(0, 10))
        .lte("expense_date", monthEnd.toISOString().slice(0, 10))
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const extract = useServerFn(extractReceipt);

  async function handleFile(file: File) {
    if (!isManager) { toast.error("Nur Manager"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Max 8 MB"); return; }

    const dataUrl = await compressImage(file, 1600, 0.85);
    setScanPreview(dataUrl);
    setScanning(true);
    try {
      const r = await extract({ data: { imageDataUrl: dataUrl } });
      if (!r.ok || !r.result) { toast.error(r.error ?? "Erkennung fehlgeschlagen"); return; }

      const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.jpg`;
      const blob = await (await fetch(dataUrl)).blob();
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      // Store the storage path (private bucket); UI resolves a signed URL on demand.
      const receiptUrl: string | null = upErr ? null : path;

      const e = r.result as ExtractedExpense;
      setEditor({
        expense_date: e.expense_date ?? new Date().toISOString().slice(0, 10),
        amount: e.amount ?? 0,
        currency: e.currency || "CHF",
        category: e.category || "Sonstiges",
        vendor: e.vendor,
        description: e.description,
        vat_amount: e.vat_amount,
        payment_method: e.payment_method,
        receipt_url: receiptUrl,
      });
      toast.success("Beleg erkannt – bitte prüfen");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan-Fehler");
    } finally {
      setScanning(false);
      setScanPreview(null);
    }
  }

  const save = useMutation({
    mutationFn: async (e: Partial<Expense>) => {
      if (!e.amount || e.amount <= 0) throw new Error("Betrag fehlt");
      if (e.id) {
        const { error } = await supabase.from("expenses").update({
          expense_date: e.expense_date, amount: e.amount, currency: e.currency,
          category: e.category, vendor: e.vendor || null, description: e.description || null,
          vat_amount: e.vat_amount ?? null, payment_method: e.payment_method || null,
          receipt_url: e.receipt_url || null,
        }).eq("id", e.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert({
          expense_date: e.expense_date ?? new Date().toISOString().slice(0, 10),
          amount: e.amount, currency: e.currency || "CHF",
          category: e.category || "Sonstiges",
          vendor: e.vendor || null, description: e.description || null,
          vat_amount: e.vat_amount ?? null, payment_method: e.payment_method || null,
          receipt_url: e.receipt_url || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); setEditor(null); toast.success("Gespeichert"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const monthLabel = monthStart.toLocaleDateString("de-CH", { month: "long", year: "numeric" });

  return (
    <div className="p-4 lg:p-10 pb-28 md:pb-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Ausgaben"
        subtitle="Belege scannen oder manuell erfassen"
        actions={
          <>
            <div className="flex items-center gap-1 glass rounded-xl p-1">
              <button onClick={() => { const d = new Date(monthStart); d.setMonth(d.getMonth() - 1); setMonthStart(d); }}
                className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 h-9 flex items-center text-xs font-medium capitalize tabular-nums">{monthLabel}</div>
              <button onClick={() => { const d = new Date(monthStart); d.setMonth(d.getMonth() + 1); setMonthStart(d); }}
                className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button
              disabled={!isManager}
              onClick={() => setEditor({ expense_date: new Date().toISOString().slice(0, 10), amount: 0, currency: "CHF", category: "Sonstiges" })}
              className="glass rounded-xl px-3 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50">
              <Plus className="w-4 h-4" /> Manuell
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        <div className="lg:col-span-2 glass rounded-3xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-accent to-neutral-300 flex items-center justify-center shrink-0 shadow-[var(--shadow-gold)]">
              <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-accent-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm md:text-base">Beleg scannen</div>
              <div className="text-[11px] md:text-xs text-muted-foreground mt-0.5">Foto machen oder hochladen – KI extrahiert Datum, Betrag, MwSt und Kategorie.</div>
            </div>
          </div>
          <div className="flex gap-2 sm:shrink-0">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <input ref={fileRef} type="file" accept="image/*" hidden
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <button disabled={!isManager || scanning} onClick={() => cameraRef.current?.click()}
              className="flex-1 sm:flex-none justify-center rounded-xl px-3 py-2.5 text-sm bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-medium shadow-[var(--shadow-gold)] flex items-center gap-2 disabled:opacity-50">
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              Foto
            </button>
            <button disabled={!isManager || scanning} onClick={() => fileRef.current?.click()}
              className="flex-1 sm:flex-none justify-center rounded-xl px-3 py-2.5 text-sm glass flex items-center gap-2 disabled:opacity-50">
              <Upload className="w-4 h-4" /> Upload
            </button>
          </div>
        </div>
        <div className="glass rounded-3xl p-4 md:p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total {monthLabel}</div>
          <div className="text-2xl md:text-3xl font-semibold tabular-nums mt-1">{total.toFixed(2)} CHF</div>
          <div className="text-xs text-muted-foreground mt-1">{expenses.length} Belege</div>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="glass rounded-2xl p-4 mb-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Nach Kategorie</div>
          <div className="flex flex-wrap gap-2">
            {byCategory.map(([cat, sum]) => (
              <div key={cat} className="px-3 py-1.5 rounded-lg bg-white/5 text-xs flex items-center gap-2">
                <span>{cat}</span>
                <span className="tabular-nums font-semibold text-accent">{sum.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass rounded-3xl overflow-hidden">
        {expenses.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
            <Receipt className="w-10 h-10 opacity-40" />
            <div>Noch keine Ausgaben für {monthLabel}.</div>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {expenses.map((e) => (
              <button key={e.id} onClick={() => setEditor(e)}
                className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.03] text-left">
                {e.receipt_url ? (
                  <ReceiptImage path={e.receipt_url} className="w-12 h-12 rounded-lg object-cover bg-white/5" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{e.vendor || e.description || e.category}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {new Date(e.expense_date + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "short" })}
                    {" · "}{e.category}
                    {e.payment_method ? ` · ${e.payment_method}` : ""}
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <div className="font-semibold">{Number(e.amount).toFixed(2)} {e.currency}</div>
                  {e.vat_amount != null && (
                    <div className="text-[10px] text-muted-foreground">MwSt {Number(e.vat_amount).toFixed(2)}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {scanning && scanPreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="glass-strong rounded-3xl p-6 max-w-sm text-center">
              <div className="relative inline-block">
                <img src={scanPreview} alt="" className="rounded-2xl max-h-64 mx-auto" />
                <div className="absolute inset-0 rounded-2xl ring-2 ring-accent animate-pulse" />
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> KI liest Beleg…
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editor && (
          <ExpenseEditor
            initial={editor}
            isManager={isManager}
            onClose={() => setEditor(null)}
            onSave={(e) => save.mutate(e)}
            saving={save.isPending}
            onDelete={editor.id ? () => { del.mutate(editor.id as string); setEditor(null); } : undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ExpenseEditor({
  initial, isManager, onClose, onSave, saving, onDelete,
}: {
  initial: Partial<Expense>;
  isManager: boolean;
  onClose: () => void;
  onSave: (e: Partial<Expense>) => void;
  saving: boolean;
  onDelete?: () => void;
}) {
  const [v, setV] = useState<Partial<Expense>>(initial);
  const set = <K extends keyof Expense>(k: K, val: Expense[K] | null) => setV((p) => ({ ...p, [k]: val }));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{initial.id ? "Bearbeiten" : "Neue Ausgabe"}</div>
            <h2 className="text-xl font-semibold">{v.vendor || "Ausgabe"}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {v.receipt_url && (
          <ReceiptLink path={v.receipt_url} />
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Datum</label>
              <input type="date" value={v.expense_date ?? ""} onChange={(e) => set("expense_date", e.target.value)}
                className="glass rounded-xl px-3 py-3 text-sm w-full outline-none bg-transparent tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Betrag</label>
              <input type="number" step="0.05" inputMode="decimal" value={v.amount ?? ""} onChange={(e) => set("amount", Number(e.target.value))}
                className="glass rounded-xl px-3 py-3 text-sm w-full outline-none bg-transparent tabular-nums" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Händler / Firma</label>
            <input value={v.vendor ?? ""} onChange={(e) => set("vendor", e.target.value)}
              placeholder="z.B. Coop, Metro, Migros"
              className="glass rounded-xl px-3 py-3 text-sm w-full outline-none bg-transparent" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Kategorie</label>
            <select value={v.category ?? "Sonstiges"} onChange={(e) => set("category", e.target.value)}
              className="glass rounded-xl px-3 py-3 text-sm w-full outline-none bg-transparent">
              {CATEGORIES.map((c) => <option key={c} value={c} className="bg-background">{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">MwSt (optional)</label>
              <input type="number" step="0.01" value={v.vat_amount ?? ""} onChange={(e) => set("vat_amount", e.target.value === "" ? null : Number(e.target.value))}
                className="glass rounded-xl px-3 py-3 text-sm w-full outline-none bg-transparent tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Zahlung</label>
              <select value={v.payment_method ?? ""} onChange={(e) => set("payment_method", e.target.value || null)}
                className="glass rounded-xl px-3 py-3 text-sm w-full outline-none bg-transparent">
                <option value="" className="bg-background">—</option>
                {["Bar", "Karte", "Twint", "Rechnung"].map((p) => <option key={p} value={p} className="bg-background">{p}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Beschreibung</label>
            <textarea value={v.description ?? ""} onChange={(e) => set("description", e.target.value)}
              rows={2}
              className="glass rounded-xl px-3 py-3 text-sm w-full outline-none bg-transparent resize-none" />
          </div>

          <div className="flex gap-2 pt-2">
            {onDelete && (
              <button onClick={onDelete}
                className="rounded-xl px-3 py-3 bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button disabled={!isManager || saving} onClick={() => onSave(v)}
              className="flex-1 rounded-2xl py-3.5 bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-semibold shadow-[var(--shadow-gold)] flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

async function compressImage(file: File, maxDim: number, quality: number): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

function useSignedReceiptUrl(pathOrUrl: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!pathOrUrl) { setUrl(null); return; }
    if (/^https?:\/\//i.test(pathOrUrl)) { setUrl(pathOrUrl); return; }
    supabase.storage.from("receipts").createSignedUrl(pathOrUrl, 3600).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [pathOrUrl]);
  return url;
}

function ReceiptImage({ path, className }: { path: string; className?: string }) {
  const url = useSignedReceiptUrl(path);
  if (!url) return <div className={className} />;
  return <img src={url} alt="" className={className} />;
}

function ReceiptLink({ path }: { path: string }) {
  const url = useSignedReceiptUrl(path);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block mb-4">
      <img src={url} alt="Beleg" className="rounded-2xl w-full max-h-64 object-contain bg-white/5" />
    </a>
  );
}
