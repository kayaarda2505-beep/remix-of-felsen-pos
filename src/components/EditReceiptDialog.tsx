import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Search, Trash2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProducts, type Product } from "@/hooks/use-products";
import { ProductModifierDialog, type ProductCustomization } from "@/components/ProductModifierDialog";
import { adjustPayments, planReceiptEdit, subtotal, type EditLine } from "@/lib/receipt-edit";

interface Props {
  order: { id: string; status: string; created_at: string; order_number?: number | null };
  payments: Array<{ id: string; amount: number }>;
  onClose: () => void;
  onSaved: () => void;
}

export function EditReceiptDialog({ order, payments, onClose, onSaved }: Props) {
  const { allProducts: products } = useProducts();
  const [original, setOriginal] = useState<EditLine[] | null>(null);
  const [lines, setLines] = useState<EditLine[]>([]);
  const [baseSentAt, setBaseSentAt] = useState<string>(order.created_at);
  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState<Product | null>(null);
  const [adjustPay, setAdjustPay] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, product_id, product_name, category, unit_price, qty, modifiers, note, sent_at")
        .eq("order_id", order.id)
        .order("sent_at", { ascending: true });
      if (!alive) return;
      if (error) {
        toast.error("Positionen laden fehlgeschlagen: " + error.message);
        return;
      }
      const rows: EditLine[] = (data ?? []).map((r: any) => ({
        id: r.id,
        product_id: r.product_id,
        product_name: r.product_name,
        category: r.category,
        unit_price: Number(r.unit_price),
        qty: Number(r.qty),
        modifiers: Array.isArray(r.modifiers) ? r.modifiers.map(String) : [],
        note: r.note ?? null,
      }));
      if (data?.[0]?.sent_at) setBaseSentAt(data[0].sent_at);
      setOriginal(rows);
      setLines(rows);
    })();
    return () => {
      alive = false;
    };
  }, [order.id]);

  const sideOptions = useMemo(
    () =>
      products
        .filter((p) => /beilag/i.test(p.category))
        .map((p) => ({ id: p.id, name: p.name, price: p.price }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  );

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.active && (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)))
      .slice(0, 30);
  }, [products, search]);

  const plan = useMemo(() => (original ? planReceiptEdit(original, lines) : null), [original, lines]);
  const hasChanges = !!plan && (plan.deleteIds.length > 0 || plan.updates.length > 0 || plan.inserts.length > 0);
  const isPaid = order.status === "paid" && payments.length > 0;

  const bump = (idx: number, d: number) =>
    setLines((cur) => cur.map((l, i) => (i === idx ? { ...l, qty: Math.max(0, l.qty + d) } : l)));
  const remove = (idx: number) =>
    setLines((cur) => (cur[idx].id ? cur.map((l, i) => (i === idx ? { ...l, qty: 0 } : l)) : cur.filter((_, i) => i !== idx)));

  const addProduct = (p: Product, c: ProductCustomization) => {
    setLines((cur) => [
      ...cur,
      {
        product_id: p.id,
        product_name: p.name,
        category: p.category,
        unit_price: +(p.price + (c.priceDelta ?? 0)).toFixed(2),
        qty: c.qty,
        modifiers: c.modifiers,
        note: c.note ?? null,
      },
    ]);
    setSearch("");
  };

  const save = async () => {
    if (!plan || !hasChanges) return;
    if (plan.newSubtotal <= 0 && !confirm("Alle Positionen werden entfernt. Trotzdem speichern?")) return;
    setSaving(true);
    try {
      if (plan.deleteIds.length) {
        const { error } = await supabase.from("order_items").delete().in("id", plan.deleteIds);
        if (error) throw new Error("Entfernen fehlgeschlagen: " + error.message);
      }
      for (const u of plan.updates) {
        const { error } = await supabase.from("order_items").update({ qty: u.qty, note: u.note }).eq("id", u.id);
        if (error) throw new Error("Ändern fehlgeschlagen: " + error.message);
      }
      if (plan.inserts.length) {
        // Gleicher Zeitpunkt wie die Originalbestellung: bleibt im selben Report-Tag,
        // löst keinen Küchenalarm aus und wird nicht nochmals an der Station gedruckt.
        const { error } = await supabase.from("order_items").insert(
          plan.inserts.map((l) => ({
            order_id: order.id,
            product_id: l.product_id,
            product_name: l.product_name,
            category: l.category,
            unit_price: l.unit_price,
            qty: l.qty,
            modifiers: l.modifiers,
            note: l.note,
            sent_at: baseSentAt,
            station_printed: true,
          })),
        );
        if (error) throw new Error("Hinzufügen fehlgeschlagen: " + error.message);
      }
      if (isPaid && adjustPay && plan.delta !== 0) {
        for (const p of adjustPayments(payments, plan.delta)) {
          const { error } = await supabase.from("payment_requests").update({ amount: p.amount }).eq("id", p.id);
          if (error) throw new Error("Zahlung anpassen fehlgeschlagen: " + error.message);
        }
      }
      toast.success("Beleg gespeichert");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const visibleLines = lines.map((l, idx) => ({ l, idx })).filter(({ l }) => l.qty > 0);
  const removedCount = lines.filter((l) => l.id && l.qty === 0).length;

  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div
        className="glass-strong w-full max-w-2xl max-h-[92vh] rounded-t-3xl md:rounded-3xl flex flex-col overflow-hidden border border-border/40 bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border/40 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Beleg bearbeiten</div>
            <div className="text-lg font-semibold">
              {order.order_number ? `#${order.order_number}` : `#${order.id.slice(0, 8)}`}
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted" aria-label="Schliessen">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!original ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Positionen</div>
                {visibleLines.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Keine Positionen</div>
                ) : (
                  <div className="space-y-2">
                    {visibleLines.map(({ l, idx }) => (
                      <div key={l.id ?? `new-${idx}`} className="flex items-center gap-3 rounded-xl bg-muted/40 p-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {l.product_name}
                            {!l.id && <span className="ml-2 text-[10px] uppercase text-primary">neu</span>}
                          </div>
                          {(l.modifiers.length > 0 || l.note) && (
                            <div className="text-xs text-muted-foreground truncate">
                              {[...l.modifiers, l.note].filter(Boolean).join(" · ")}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground tabular-nums">CHF {l.unit_price.toFixed(2)}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => bump(idx, -1)} className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center" aria-label="Weniger">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-7 text-center font-semibold tabular-nums">{l.qty}</span>
                          <button type="button" onClick={() => bump(idx, 1)} className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center" aria-label="Mehr">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="w-16 text-right text-sm tabular-nums">{(l.unit_price * l.qty).toFixed(2)}</div>
                        <button type="button" onClick={() => remove(idx)} className="w-9 h-9 rounded-lg text-destructive hover:bg-destructive/15 flex items-center justify-center" aria-label="Entfernen">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {removedCount > 0 && (
                  <div className="text-xs text-muted-foreground mt-2">
                    {removedCount} Position{removedCount > 1 ? "en" : ""} wird entfernt.{" "}
                    <button type="button" className="underline" onClick={() => setLines(original)}>
                      Alles zurücksetzen
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Artikel hinzufügen</div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Produkt suchen, z. B. Margherita, Cola…"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-muted/50 border border-border/40 text-sm outline-none focus:border-primary"
                  />
                </div>
                {results.length > 0 && (
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border/40 divide-y divide-border/30">
                    {results.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPicking(p)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <div className="text-sm truncate">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground">{p.category}</div>
                        </div>
                        <div className="text-sm tabular-nums">CHF {p.price.toFixed(2)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-border/40 space-y-3">
          {plan && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Vorher {plan.oldSubtotal.toFixed(2)} → Neu
              </span>
              <span className="font-semibold tabular-nums">
                CHF {subtotal(lines.filter((l) => l.qty > 0)).toFixed(2)}
                {plan.delta !== 0 && (
                  <span className={plan.delta > 0 ? "text-success ml-2" : "text-destructive ml-2"}>
                    ({plan.delta > 0 ? "+" : ""}{plan.delta.toFixed(2)})
                  </span>
                )}
              </span>
            </div>
          )}
          {isPaid && plan && plan.delta !== 0 && (
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={adjustPay} onChange={(e) => setAdjustPay(e.target.checked)} className="mt-0.5" />
              <span>Bezahlten Betrag um {plan.delta > 0 ? "+" : ""}{plan.delta.toFixed(2)} CHF anpassen (Trinkgeld bleibt gleich)</span>
            </label>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-muted text-sm">
              Abbrechen
            </button>
            <button
              type="button"
              disabled={!hasChanges || saving}
              onClick={save}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Speichern
            </button>
          </div>
        </div>
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <ProductModifierDialog
          product={picking}
          open={!!picking}
          sides={sideOptions}
          onClose={() => setPicking(null)}
          onConfirm={(c) => {
            if (picking) addProduct(picking, c);
          }}
        />
      </div>
    </div>
  );
}
