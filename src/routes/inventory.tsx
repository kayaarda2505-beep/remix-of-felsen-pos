import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Package, AlertTriangle, TrendingDown, Loader2, PackagePlus, Plus, Trash2, Check, X, Pencil, ScanLine, ChevronDown, ShoppingCart, FileText, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { toast } from "sonner";
import { printReceipt, isDesktopApp, type PrinterConfig, type ReceiptPayload } from "@/lib/printer-bridge";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Lager — SAINTS POS" }] }),
  component: Inventory,
});

interface Supplier {
  id?: string;
  name: string;
  address: string | null;
  contact: string | null;
  price: number;
  is_preferred: boolean;
}

interface Ingredient {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  min_stock: number;
  cost_per_unit: number;
  sale_price: number;
  barcode: string | null;
  container_type: string | null;
  supplier_name: string | null;
  supplier_address: string | null;
  supplier_contact: string | null;
  suppliers?: Supplier[];
}

const UNITS = ["cl", "ml", "l", "g", "kg", "stk"];
const CONTAINER_TYPES = ["Flasche", "Dose", "Fass"];
const DEFAULT_CATEGORIES = ["Spirituose", "Likör", "Wein", "Bier", "Softdrink", "Saft", "Sirup", "Frucht", "Kräuter", "Sonstiges"];

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function Inventory() {
  const qc = useQueryClient();
  const { operator } = useAuth();
  const canEdit = operator?.role === "manager";
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Ingredient>>({});
  const [creating, setCreating] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [restock, setRestock] = useState<{ item: Ingredient; qty: number } | null>(null);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [shoppingQty, setShoppingQty] = useState<Record<string, number>>({});
  const [newItem, setNewItem] = useState<Partial<Ingredient>>({
    name: "",
    category: "Spirituose",
    unit: "cl",
    stock: 0,
    min_stock: 0,
    cost_per_unit: 0,
    sale_price: 0,
    barcode: "",
    container_type: "Flasche",
    supplier_name: "",
    supplier_address: "",
    supplier_contact: "",
    suppliers: [],
  });

  const { data: items = [], isLoading } = useQuery<Ingredient[]>({
    queryKey: ["ingredients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingredients")
        .select("id, name, category, unit, stock, min_stock, cost_per_unit, sale_price, barcode, container_type, supplier_name, supplier_address, supplier_contact, ingredient_suppliers(id, name, address, contact, price, is_preferred, sort_order)")
        .eq("active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((row) => ({
        ...row,
        suppliers: ((row.ingredient_suppliers ?? []) as any[])
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((s) => ({ id: s.id, name: s.name, address: s.address, contact: s.contact, price: Number(s.price), is_preferred: !!s.is_preferred })),
      })) as Ingredient[];
    },
  });

  const categories = Array.from(new Set([...DEFAULT_CATEGORIES, ...items.map((i) => i.category)])).filter(Boolean);

  const lowCount = items.filter((i) => Number(i.stock) < Number(i.min_stock)).length;
  const totalValue = items.reduce((s, i) => s + Number(i.stock) * Number(i.cost_per_unit), 0);

  const startEdit = (it: Ingredient) => {
    setEditingId(it.id);
    setDraft({ ...it, suppliers: it.suppliers ? it.suppliers.map((s) => ({ ...s })) : [] });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const persistSuppliers = async (ingredientId: string, suppliers: Supplier[]) => {
    const sb = supabase as any;
    await sb.from("ingredient_suppliers").delete().eq("ingredient_id", ingredientId);
    const cleaned = (suppliers ?? [])
      .filter((s) => s.name && s.name.trim().length > 0)
      .map((s, idx) => ({
        ingredient_id: ingredientId,
        name: s.name.trim(),
        address: s.address?.toString().trim() || null,
        contact: s.contact?.toString().trim() || null,
        price: Number(s.price ?? 0),
        is_preferred: !!s.is_preferred,
        sort_order: idx,
      }));
    if (cleaned.length === 0) return;
    // Ensure exactly one preferred
    if (!cleaned.some((s) => s.is_preferred)) cleaned[0].is_preferred = true;
    const { error } = await sb.from("ingredient_suppliers").insert(cleaned);
    if (error) throw error;
  };
  const saveEdit = async () => {
    if (!editingId) return;
    const suppliers = (draft.suppliers ?? []) as Supplier[];
    const preferred = suppliers.find((s) => s.is_preferred) ?? suppliers[0];
    const patch = {
      name: (draft.name ?? "").toString().trim(),
      category: (draft.category ?? "").toString().trim(),
      unit: (draft.unit ?? "cl").toString(),
      stock: Number(draft.stock ?? 0),
      min_stock: Number(draft.min_stock ?? 0),
      cost_per_unit: preferred ? Number(preferred.price ?? 0) : Number(draft.cost_per_unit ?? 0),
      sale_price: Number(draft.sale_price ?? 0),
      barcode: (draft.barcode ?? "").toString().trim() || null,
      container_type: (draft.container_type ?? "").toString().trim() || null,
      supplier_name: preferred?.name ?? null,
      supplier_address: preferred?.address ?? null,
      supplier_contact: preferred?.contact ?? null,
    };
    if (!patch.name) return toast.error("Name fehlt");
    const { error } = await supabase.from("ingredients").update(patch).eq("id", editingId);
    if (error) return toast.error(error.message);
    try {
      await persistSuppliers(editingId, suppliers);
    } catch (e: any) {
      return toast.error(e?.message ?? "Lieferanten konnten nicht gespeichert werden");
    }
    toast.success("Gespeichert");
    cancelEdit();
    qc.invalidateQueries({ queryKey: ["ingredients"] });
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Rohstoff wirklich löschen?")) return;
    const { error } = await supabase.from("ingredients").update({ active: false }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Gelöscht");
    qc.invalidateQueries({ queryKey: ["ingredients"] });
  };

  const createItem = async () => {
    const suppliers = (newItem.suppliers ?? []) as Supplier[];
    const preferred = suppliers.find((s) => s.is_preferred) ?? suppliers[0];
    const payload = {
      name: (newItem.name ?? "").toString().trim(),
      category: (newItem.category ?? "Sonstiges").toString().trim(),
      unit: (newItem.unit ?? "cl").toString(),
      stock: Number(newItem.stock ?? 0),
      min_stock: Number(newItem.min_stock ?? 0),
      cost_per_unit: preferred ? Number(preferred.price ?? 0) : Number(newItem.cost_per_unit ?? 0),
      sale_price: Number(newItem.sale_price ?? 0),
      barcode: (newItem.barcode ?? "").toString().trim() || null,
      container_type: (newItem.container_type ?? "").toString().trim() || null,
      supplier_name: preferred?.name ?? null,
      supplier_address: preferred?.address ?? null,
      supplier_contact: preferred?.contact ?? null,
    };
    if (!payload.name) return toast.error("Name fehlt");
    const { data, error } = await supabase.from("ingredients").insert(payload).select("id").single();
    if (error) return toast.error(error.message);
    if (data?.id && suppliers.length) {
      try { await persistSuppliers(data.id, suppliers); } catch (e: any) {
        toast.error(e?.message ?? "Lieferanten konnten nicht gespeichert werden");
      }
    }
    toast.success("Rohstoff angelegt");
    setCreating(false);
    setNewItem({ name: "", category: "Spirituose", unit: "cl", stock: 0, min_stock: 0, cost_per_unit: 0, sale_price: 0, barcode: "", container_type: "Flasche", supplier_name: "", supplier_address: "", supplier_contact: "", suppliers: [] });
    qc.invalidateQueries({ queryKey: ["ingredients"] });
  };

  const handleScan = (code: string) => {
    setScanOpen(false);
    const found = items.find((i) => (i.barcode ?? "").trim() === code.trim());
    if (found) {
      setRestock({ item: found, qty: 1 });
    } else {
      toast.info(`Neuer Code ${code} — bitte Artikel anlegen`);
      setNewItem({ name: "", category: "Spirituose", unit: "stk", stock: 0, min_stock: 0, cost_per_unit: 0, sale_price: 0, barcode: code, container_type: "Flasche", supplier_name: "", supplier_address: "", supplier_contact: "", suppliers: [] });
      setCreating(true);
    }
  };

  const confirmRestock = async () => {
    if (!restock) return;
    const newStock = Number(restock.item.stock) + Number(restock.qty);
    const { error } = await supabase.from("ingredients").update({ stock: newStock }).eq("id", restock.item.id);
    if (error) return toast.error(error.message);
    toast.success(`+${restock.qty} ${restock.item.unit} ${restock.item.name}`);
    setRestock(null);
    qc.invalidateQueries({ queryKey: ["ingredients"] });
  };

  

  const shoppingItems = useMemo(
    () =>
      items.filter((i) => {
        const stock = Number(i.stock);
        const min = Number(i.min_stock);
        return stock <= 0 || stock < min;
      }),
    [items],
  );

  const suggestedQty = (it: Ingredient) => {
    const stock = Number(it.stock);
    const min = Number(it.min_stock);
    const target = min > 0 ? min * 2 : Math.max(1, Math.abs(stock));
    const need = Math.max(0, target - stock);
    return Math.ceil(need * 100) / 100;
  };

  const qtyFor = (it: Ingredient) =>
    shoppingQty[it.id] !== undefined ? Number(shoppingQty[it.id]) : suggestedQty(it);

  const openShoppingList = () => {
    setShoppingQty({});
    setShoppingOpen(true);
  };

  const shoppingSelected = () =>
    shoppingItems
      .map((it) => ({ ...it, orderQty: qtyFor(it) }))
      .filter((it) => it.orderQty > 0);

  const shoppingTotalCost = () =>
    shoppingSelected().reduce((s, it) => s + it.orderQty * Number(it.cost_per_unit), 0);

  const printShoppingPdf = () => {
    const list = shoppingSelected();
    if (!list.length) return toast.error("Keine Artikel ausgewählt");
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return toast.error("Popup blockiert");
    const dateStr = new Date().toLocaleString("de-CH");
    const groups = new Map<string, typeof list>();
    for (const it of list) {
      const k = it.category || "Sonstiges";
      if (!groups.has(k)) groups.set(k, [] as typeof list);
      groups.get(k)!.push(it);
    }
    const rows = Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, arr]) => {
        const body = arr
          .map(
            (it) => `
            <tr>
              <td>${escapeHtml(it.name)}</td>
              <td style="text-align:right">${it.orderQty} ${escapeHtml(it.unit)}</td>
              <td style="text-align:right">CHF ${(it.orderQty * Number(it.cost_per_unit)).toFixed(2)}</td>
              <td></td>
            </tr>`,
          )
          .join("");
        return `<tr class="cat"><td colspan="4">${escapeHtml(cat)}</td></tr>${body}`;
      })
      .join("");
    const total = shoppingTotalCost().toFixed(2);
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Einkaufsliste SAINTS</title>
      <style>
        body{font-family:-apple-system,Inter,Arial,sans-serif;padding:32px;color:#111}
        h1{margin:0 0 4px;font-size:22px}
        .meta{color:#666;font-size:12px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{padding:6px 8px;border-bottom:1px solid #eee}
        th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#666}
        tr.cat td{background:#f5f5f5;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
        tfoot td{font-weight:700;border-top:2px solid #111;border-bottom:none}
        .check{width:24px;border:1px solid #999;display:inline-block;height:14px}
      </style></head><body>
      <h1>SAINTS — Einkaufsliste</h1>
      <div class="meta">${dateStr}</div>
      <table>
        <thead><tr><th>Artikel</th><th style="text-align:right">Menge</th><th style="text-align:right">EK</th><th>✓</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="2">Geschätzter Einkaufswert</td><td style="text-align:right">CHF ${total}</td><td></td></tr></tfoot>
      </table>
      <script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
      </body></html>`);
    w.document.close();
  };

  const printShoppingBon = async () => {
    const list = shoppingSelected();
    if (!list.length) return toast.error("Keine Artikel ausgewählt");
    if (!isDesktopApp()) {
      toast.error("Bon-Druck nur in der Desktop-App – nutze PDF");
      return;
    }
    const { data: printers } = await supabase
      .from("printers")
      .select("id, name, type, ip_address, port")
      .eq("active", true);
    const p = (printers ?? []).find((x) => x.type === "bon") ??
              (printers ?? []).find((x) => x.type === "rechnung") ??
              (printers ?? [])[0];
    if (!p) return toast.error("Kein Drucker konfiguriert");
    const lines: ReceiptPayload["lines"] = [];
    lines.push({ text: "EINKAUFSLISTE", align: "center", bold: true, size: "large" });
    lines.push({ text: "SAINTS", align: "center" });
    lines.push({ text: new Date().toLocaleString("de-CH"), align: "center" });
    lines.push({ separator: true });
    const groups = new Map<string, typeof list>();
    for (const it of list) {
      const k = it.category || "Sonstiges";
      if (!groups.has(k)) groups.set(k, [] as typeof list);
      groups.get(k)!.push(it);
    }
    for (const [cat, arr] of Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      lines.push({ text: cat.toUpperCase(), bold: true });
      for (const it of arr) {
        lines.push({ cols: [it.name.slice(0, 22), `${it.orderQty} ${it.unit}`] });
      }
      lines.push({ separator: true });
    }
    lines.push({ cols: ["TOTAL EK", `CHF ${shoppingTotalCost().toFixed(2)}`], bold: true });
    const r = await printReceipt(p as PrinterConfig, { title: "Einkauf", lines, cut: true });
    if (!r.ok) return toast.error(r.error ?? "Druckfehler");
    toast.success("Einkaufsliste gedruckt");
    setShoppingOpen(false);
  };


  return (
    <div className="p-4 md:p-6 lg:p-10 pb-28 md:pb-10 max-w-[1600px] mx-auto">
      <PageHeader
        title="Lager"
        subtitle="Rohstoffe, Bestände & Mindestmengen"
        actions={
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={openShoppingList}
              className="glass rounded-xl px-4 py-2 text-sm hover:border-accent/40 transition-colors flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" /> Einkaufsliste
            </button>
            {canEdit && (
              <>
                <button
                  onClick={() => setScanOpen(true)}
                  className="glass rounded-xl px-4 py-2 text-sm hover:border-accent/40 transition-colors flex items-center gap-2"
                >
                  <ScanLine className="w-4 h-4" /> Scannen
                </button>
                <button
                  onClick={() => setCreating((v) => !v)}
                  className="glass rounded-xl px-4 py-2 text-sm hover:border-accent/40 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Neuer Rohstoff
                </button>
              </>
            )}
          </div>
        }
      />


      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { icon: Package, label: "Rohstoffe", value: items.length.toString() },
          { icon: AlertTriangle, label: "Unter Min", value: lowCount.toString(), accent: lowCount > 0 },
          { icon: TrendingDown, label: "Lagerwert", value: `CHF ${totalValue.toFixed(0)}` },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-5 flex items-center gap-4"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.accent ? "bg-warning/15" : "bg-white/5"}`}>
              <s.icon className={`w-5 h-5 ${s.accent ? "text-warning" : "text-accent"}`} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</div>
              <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>


      <div className="glass rounded-3xl overflow-hidden overflow-x-auto">
        <div className="min-w-[960px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 px-6">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <PackagePlus className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">Noch keine Rohstoffe</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Lege Rohstoffe an, um Bestände zu verfolgen.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1.5fr_1fr_1fr_0.7fr_1fr_0.7fr_0.7fr_0.7fr_90px] gap-3 px-5 py-3 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
              <div>Artikel</div>
              <div>Kategorie</div>
              <div>Barcode</div>
              <div>Einheit</div>
              <div>Bestand / Min</div>
              <div className="text-right">EK</div>
              <div className="text-right">VK</div>
              <div className="text-right">Wert</div>
              <div className="text-right">Aktion</div>
            </div>
            {(() => {

              const groups = new Map<string, Ingredient[]>();
              for (const it of items) {
                const k = it.category || "Sonstiges";
                if (!groups.has(k)) groups.set(k, []);
                groups.get(k)!.push(it);
              }
              const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
              let rowIdx = 0;
              return sortedGroups.map(([cat, list]) => {
                const collapsed = collapsedCats.has(cat);
                const catValue = list.reduce((s, x) => s + Number(x.stock) * Number(x.cost_per_unit), 0);
                const catLow = list.filter((x) => Number(x.stock) < Number(x.min_stock)).length;
                return (
                  <div key={cat}>
                    <button
                      onClick={() => {
                        setCollapsedCats((prev) => {
                          const next = new Set(prev);
                          if (next.has(cat)) next.delete(cat); else next.add(cat);
                          return next;
                        });
                      }}
                      className="w-full flex items-center gap-3 px-5 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] border-b border-border/30 transition-colors text-left"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                      <span className="text-xs font-semibold uppercase tracking-wider">{cat}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{list.length}</span>
                      {catLow > 0 && (
                        <span className="text-[10px] text-warning tabular-nums flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {catLow}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">CHF {catValue.toFixed(2)}</span>
                    </button>
                    {!collapsed && list.map((it) => {
                       const i = rowIdx++;
              const low = Number(it.stock) < Number(it.min_stock);
              const pct = Math.min(100, (Number(it.stock) / Math.max(1, Number(it.min_stock) * 2)) * 100);
              const value = Number(it.stock) * Number(it.cost_per_unit);
              return (
                <motion.div
                  key={it.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.01, 0.3) }}
                  className="grid grid-cols-[1.5fr_1fr_1fr_0.7fr_1fr_0.7fr_0.7fr_0.7fr_90px] gap-3 px-5 py-3 items-center text-sm border-b border-border/20 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="font-medium min-w-0">
                    <div className="flex items-center gap-2">
                      {low && <span className="w-1.5 h-1.5 rounded-full bg-warning pulse-dot shrink-0" />}
                      <span className="truncate">{it.name}</span>
                    </div>
                    {(() => {
                      const sups = it.suppliers ?? [];
                      const pref = sups.find((s) => s.is_preferred) ?? sups[0];
                      const label = pref?.name ?? it.supplier_name;
                      if (!label) return null;
                      const extra = sups.length > 1 ? ` · +${sups.length - 1} weitere` : "";
                      return (
                        <div className="text-[10px] text-muted-foreground/70 truncate">
                          {label}{pref ? ` · CHF ${Number(pref.price).toFixed(2)}` : ""}{extra}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="text-xs text-muted-foreground">{it.category}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{it.barcode ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{it.unit}{it.container_type ? ` · ${it.container_type}` : ""}</div>
                  <div className="flex items-center gap-2">
                    <span className={`tabular-nums text-xs w-20 shrink-0 ${low ? "text-warning" : ""}`}>
                      {Number(it.stock)}/{Number(it.min_stock)}
                    </span>
                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${low ? "bg-warning" : "bg-success"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-right tabular-nums text-xs text-muted-foreground">CHF {Number(it.cost_per_unit).toFixed(2)}</div>
                  <div className="text-right tabular-nums text-xs">CHF {Number(it.sale_price ?? 0).toFixed(2)}</div>
                  <div className="text-right tabular-nums text-xs">CHF {value.toFixed(2)}</div>
                  <div className="flex justify-end gap-1">
                    {canEdit ? (
                      <>
                        <button onClick={() => startEdit(it)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteItem(it.id)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-destructive/20 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">—</span>
                    )}
                  </div>
                </motion.div>
              );
            })}

                  </div>
                );
              });
            })()}
          </>

        )}
        </div>
      </div>

      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onDetected={handleScan} />

      {restock && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass rounded-3xl w-full max-w-sm p-6">
            <h3 className="font-semibold mb-1">{restock.item.name}</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Aktuell: {Number(restock.item.stock)} {restock.item.unit}
            </p>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Menge hinzufügen</label>
            <input
              type="number"
              step="0.01"
              autoFocus
              value={restock.qty}
              onChange={(e) => setRestock({ ...restock, qty: Number(e.target.value) })}
              className="w-full mt-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-lg tabular-nums focus:outline-none focus:border-accent/50"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setRestock(null)} className="flex-1 rounded-lg bg-white/5 hover:bg-white/10 py-2 text-sm">
                Abbrechen
              </button>
              <button onClick={confirmRestock} className="flex-1 rounded-lg bg-accent/20 hover:bg-accent/30 py-2 text-sm">
                Buchen
              </button>
            </div>
          </div>
        </div>
      )}

      {shoppingOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-border/40 flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 text-accent" />
              <div className="flex-1">
                <h3 className="font-semibold">Einkaufsliste</h3>
                <p className="text-xs text-muted-foreground">
                  {shoppingItems.length} Artikel unter Mindestbestand · Mengen anpassen
                </p>
              </div>
              <button onClick={() => setShoppingOpen(false)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {shoppingItems.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  Alle Bestände sind über dem Minimum 🎉
                </div>
              ) : (
                <div className="space-y-1">
                  {shoppingItems.map((it) => (
                    <div key={it.id} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-2 rounded-lg hover:bg-white/[0.03]">
                      <div>
                        <div className="text-sm font-medium">{it.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {it.category} · Bestand {Number(it.stock)}/{Number(it.min_stock)} {it.unit}
                        </div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={qtyFor(it)}
                        onChange={(e) => setShoppingQty({ ...shoppingQty, [it.id]: Number(e.target.value) })}
                        className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-right tabular-nums focus:outline-none focus:border-accent/50"
                      />
                      <div className="w-10 text-xs text-muted-foreground">{it.unit}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border/40 flex items-center gap-3">
              <div className="flex-1 text-xs text-muted-foreground">
                Geschätzt: <span className="tabular-nums text-foreground">CHF {shoppingTotalCost().toFixed(2)}</span>
              </div>
              <button
                onClick={printShoppingBon}
                className="rounded-xl px-4 py-2 text-sm bg-white/5 hover:bg-white/10 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Bon
              </button>
              <button
                onClick={printShoppingPdf}
                className="rounded-xl px-4 py-2 text-sm bg-accent/20 hover:bg-accent/30 flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {(creating || editingId) && (() => {
        const isCreate = creating;
        const data = isCreate ? newItem : draft;
        const setData = (patch: Partial<Ingredient>) =>
          isCreate ? setNewItem({ ...newItem, ...patch }) : setDraft({ ...draft, ...patch });
        const onSave = isCreate ? createItem : saveEdit;
        const onClose = isCreate ? () => setCreating(false) : cancelEdit;
        const fieldCls = "bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-accent/50";
        const labelCls = "text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block";
        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-border/40 flex items-center gap-3">
                <PackagePlus className="w-5 h-5 text-accent" />
                <h3 className="font-semibold flex-1">{isCreate ? "Neuer Rohstoff" : "Rohstoff bearbeiten"}</h3>
                <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-accent mb-3 font-semibold">Artikel</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className={labelCls}>Name</label>
                      <input className={fieldCls} value={(data.name as string) ?? ""} onChange={(e) => setData({ name: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Kategorie</label>
                      <input list="categories" className={fieldCls} value={(data.category as string) ?? ""} onChange={(e) => setData({ category: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Einheit</label>
                      <select className={fieldCls} value={(data.unit as string) ?? "cl"} onChange={(e) => setData({ unit: e.target.value })}>
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Gebinde</label>
                      <select className={fieldCls} value={(data.container_type as string) ?? ""} onChange={(e) => setData({ container_type: e.target.value })}>
                        <option value="">—</option>
                        {CONTAINER_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Barcode (optional)</label>
                      <input className={fieldCls} value={(data.barcode as string) ?? ""} onChange={(e) => setData({ barcode: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] uppercase tracking-wider text-accent mb-3 font-semibold">Bestand & Preise</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Bestand</label>
                      <input type="number" min={0} step="0.01" className={fieldCls} value={(data.stock as number) ?? 0} onChange={(e) => setData({ stock: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className={labelCls}>Mindestbestand</label>
                      <input type="number" min={0} step="0.01" className={fieldCls} value={(data.min_stock as number) ?? 0} onChange={(e) => setData({ min_stock: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className={labelCls}>Einkaufspreis (EK) CHF</label>
                      <input type="number" min={0} step="0.01" className={fieldCls} value={(data.cost_per_unit as number) ?? 0} onChange={(e) => setData({ cost_per_unit: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className={labelCls}>Verkaufspreis (VK) CHF</label>
                      <input type="number" min={0} step="0.01" className={fieldCls} value={(data.sale_price as number) ?? 0} onChange={(e) => setData({ sale_price: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] uppercase tracking-wider text-accent font-semibold">Lieferanten</div>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = (data.suppliers ?? []) as Supplier[];
                        const next: Supplier = { name: "", address: "", contact: "", price: 0, is_preferred: cur.length === 0 };
                        setData({ suppliers: [...cur, next] });
                      }}
                      className="text-xs rounded-lg bg-white/5 hover:bg-white/10 px-3 py-1.5 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Lieferant
                    </button>
                  </div>
                  {((data.suppliers ?? []) as Supplier[]).length === 0 && (
                    <div className="text-xs text-muted-foreground/70 italic mb-2">Noch keine Lieferanten — füge einen oder mehrere hinzu.</div>
                  )}
                  <div className="space-y-3">
                    {((data.suppliers ?? []) as Supplier[]).map((sup, idx) => {
                      const list = (data.suppliers ?? []) as Supplier[];
                      const update = (patch: Partial<Supplier>) => {
                        const next = list.map((s, i) => (i === idx ? { ...s, ...patch } : s));
                        setData({ suppliers: next });
                      };
                      const setPreferred = () => {
                        const next = list.map((s, i) => ({ ...s, is_preferred: i === idx }));
                        setData({ suppliers: next });
                      };
                      const remove = () => {
                        const next = list.filter((_, i) => i !== idx);
                        if (next.length > 0 && !next.some((s) => s.is_preferred)) next[0].is_preferred = true;
                        setData({ suppliers: next });
                      };
                      return (
                        <div key={idx} className={`rounded-xl border p-3 space-y-2 ${sup.is_preferred ? "border-accent/40 bg-accent/5" : "border-white/10 bg-white/[0.02]"}`}>
                          <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                            <input className={fieldCls} placeholder="Händler / Geschäft" value={sup.name} onChange={(e) => update({ name: e.target.value })} />
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-2">
                              <input type="radio" checked={sup.is_preferred} onChange={setPreferred} />
                              Bevorzugt
                            </label>
                            <button type="button" onClick={remove} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-destructive/20 flex items-center justify-center">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input className={fieldCls} placeholder="Adresse" value={sup.address ?? ""} onChange={(e) => update({ address: e.target.value })} />
                            <input className={fieldCls} placeholder="Kontakt (Tel / Mail / Web)" value={sup.contact ?? ""} onChange={(e) => update({ contact: e.target.value })} />
                          </div>
                          <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
                            <label className={labelCls + " mb-0"}>Preis CHF</label>
                            <input type="number" min={0} step="0.01" className={fieldCls} value={sup.price} onChange={(e) => update({ price: Number(e.target.value) })} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground/60">
                    Der bevorzugte Lieferantenpreis wird als Einkaufspreis (EK) für Lagerwert &amp; Einkaufsliste verwendet.
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-border/40 flex gap-2">
                <button onClick={onClose} className="flex-1 rounded-xl bg-white/5 hover:bg-white/10 py-2.5 text-sm">Abbrechen</button>
                <button onClick={onSave} className="flex-1 rounded-xl bg-accent/20 hover:bg-accent/30 py-2.5 text-sm flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> {isCreate ? "Anlegen" : "Speichern"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>

  );
}
