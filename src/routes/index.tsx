import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import { useMemo, useState, useRef, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sumupSendToReader, sumupGetTransactionStatus } from "@/lib/sumup.functions";

import { useAuth } from "@/hooks/use-auth";
import {
  Minus,
  Plus,
  Send,
  Search,
  ArrowLeft,
  ChevronRight,
  Users,
  ShoppingBag,
  Check,
  Pencil,
  Sofa,
  TreePine,
  Wine,
  Loader2,
  Receipt,
  CreditCard,
  X,
  RotateCw,
  Trash2,
  Shapes,
  Move,
  Banknote,
  Smartphone,
} from "lucide-react";
import { useProducts, type Product } from "@/hooks/use-products";
import { supabase } from "@/integrations/supabase/client";
import { ProductModifierDialog, type ProductCustomization } from "@/components/ProductModifierDialog";
import { printOrderToStations, printBill, printCardReceipt, type ReceiptItem } from "@/lib/receipt";
import { isDesktopApp } from "@/lib/printer-bridge";

type Area = "indoor" | "outdoor" | "bar";
interface DiningTable {
  id: string;
  name: string;
  seats: number;
  area: Area;
  sort_order?: number;
  pos_x?: number | null;
  pos_y?: number | null;
}
interface OpenOrder {
  id: string;
  table_id: string;
  total: number;
  guests: number | null;
  opened_at: string;
}
interface OrderItem {
  id: string;
  product_name: string;
  unit_price: number;
  qty: number;
  modifiers: string[];
  note: string | null;
}
const AREAS: { value: Area; label: string; icon: typeof Sofa }[] = [
  { value: "indoor", label: "Drinnen", icon: Sofa },
  { value: "outdoor", label: "Draussen", icon: TreePine },
  { value: "bar", label: "An der Bar", icon: Wine },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Service — FELSEN POS" },
      { name: "description", content: "Tablet-Service: Tisch wählen, Bestellung aufnehmen, an Bar & Küche senden." },
    ],
  }),
  component: ServiceTablet,
});

type Step = "tables" | "tab" | "menu" | "sent";
interface CartLine {
  id: string;
  product: Product;
  qty: number;
  modifiers: string[];
  note?: string;
}

function ServiceTablet() {
  const { products, categories } = useProducts();
  const [step, setStep] = useState<Step>("tables");
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [guests, setGuests] = useState(2);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [areaFilter, setAreaFilter] = useState<Area | "all">("all");
  const [editLayout, setEditLayout] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const { data: tables = [], isLoading: tablesLoading } = useQuery<DiningTable[]>({
    queryKey: ["dining_tables", "service"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dining_tables")
        .select("id, name, seats, area, sort_order, pos_x, pos_y")
        .order("area")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as DiningTable[];
    },
  });

  const { data: openOrders = [] } = useQuery<OpenOrder[]>({
    queryKey: ["orders", "open", "service"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, table_id, total, guests, opened_at")
        .eq("status", "open")
        .not("table_id", "is", null);
      if (error) throw error;
      return (data ?? []) as OpenOrder[];
    },
    refetchInterval: 5000,
  });
  const orderByTable = useMemo(() => {
    const m = new Map<string, OpenOrder>();
    openOrders.forEach((o) => m.set(o.table_id, o));
    return m;
  }, [openOrders]);
  const activeTableOrder = selectedTable ? orderByTable.get(selectedTable.id) ?? null : null;

  const { data: tabItems = [], isLoading: tabLoading } = useQuery<OrderItem[]>({
    queryKey: ["order_items", activeTableOrder?.id],
    enabled: !!activeTableOrder,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, product_name, unit_price, qty, modifiers, note")
        .eq("order_id", activeTableOrder!.id)
        .order("sent_at");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        modifiers: Array.isArray(r.modifiers) ? (r.modifiers as string[]) : [],
      })) as OrderItem[];
    },
  });
  const { operator } = useAuth();
  const qc = useQueryClient();

  const { data: printers = [] } = useQuery({
    queryKey: ["printers", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("printers")
        .select("id, name, type, ip_address, port")
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });


  const payTab = useMutation({
    mutationFn: async () => {
      if (!activeTableOrder || !selectedTable) throw new Error("Keine offene Rechnung");
      // Rechnung drucken (vor dem Schliessen, damit tabItems noch da sind)
      if (isDesktopApp()) {
        const err = await printBill({
          printers,
          tableName: selectedTable.name,
          items: tabItems.map((it) => ({
            product_name: it.product_name,
            qty: it.qty,
            unit_price: Number(it.unit_price),
            modifiers: it.modifiers,
          })),
          total: Number(activeTableOrder.total),
        });
        if (err) toast.error(`Druck: ${err}`);
      }
      const { error: oErr } = await supabase
        .from("orders")
        .update({ status: "paid", closed_at: new Date().toISOString() })
        .eq("id", activeTableOrder.id);
      if (oErr) throw oErr;
      const { error: tErr } = await supabase
        .from("dining_tables")
        .update({ status: "free", opened_at: null, guests: null })
        .eq("id", selectedTable.id);
      if (tErr) throw tErr;
    },
    onSuccess: () => {
      toast.success("Tisch abgeschlossen");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dining_tables"] });
      reset();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const printInterim = async () => {
    if (!activeTableOrder || !selectedTable) return;
    if (!isDesktopApp()) {
      setShowInterim(true); // Fallback: Vorschau-Dialog im Browser
      return;
    }
    const err = await printBill({
      printers,
      tableName: selectedTable.name,
      items: tabItems.map((it) => ({
        product_name: it.product_name,
        qty: it.qty,
        unit_price: Number(it.unit_price),
        modifiers: it.modifiers,
      })),
      total: Number(activeTableOrder.total),
      interim: true,
    });
    if (err) toast.error(`Druck: ${err}`);
    else toast.success("Zwischenrechnung gedruckt");
  };
  const [showInterim, setShowInterim] = useState(false);
  const [showPayChoice, setShowPayChoice] = useState(false);


  const sendOrder = useMutation({
    mutationFn: async () => {
      if (!selectedTable) throw new Error("Kein Tisch ausgewählt");
      if (cart.length === 0) throw new Error("Warenkorb leer");

      // Find or create the open order for this table
      const { data: existing, error: exErr } = await supabase
        .from("orders")
        .select("id")
        .eq("table_id", selectedTable.id)
        .eq("status", "open")
        .maybeSingle();
      if (exErr) throw exErr;

      let orderId = existing?.id;
      if (!orderId) {
        const { data: created, error: insErr } = await supabase
          .from("orders")
          .insert({
            table_id: selectedTable.id,
            status: "open",
            guests,
            opened_by_name: operator?.name ?? null,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        orderId = created.id;
      }

      const rows = cart.map((l) => ({
        order_id: orderId!,
        product_id: l.product.id,
        product_name: l.product.name,
        category: l.product.category,
        unit_price: l.product.price,
        qty: l.qty,
        modifiers: l.modifiers,
        note: l.note ?? null,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(rows);
      if (itemsErr) throw itemsErr;

      // Mark table as occupied
      await supabase
        .from("dining_tables")
        .update({ status: "occupied", opened_at: new Date().toISOString(), guests })
        .eq("id", selectedTable.id);
    },
    onSuccess: async (_d, _v, ctx) => {
      qc.invalidateQueries({ queryKey: ["dining_tables"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order_items"] });
      // Auto-Druck an Bar / Küche
      if (isDesktopApp() && selectedTable) {
        const items: ReceiptItem[] = cart.map((l) => ({
          product_name: l.product.name,
          qty: l.qty,
          unit_price: l.product.price,
          category: l.product.category,
          modifiers: l.modifiers,
          note: l.note ?? null,
        }));
        const errs = await printOrderToStations({
          printers,
          tableName: selectedTable.name,
          items,
          operatorName: operator?.name ?? null,
        });
        errs.forEach((e) => toast.error(e));
      }
      setStep("sent");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler beim Senden"),
  });

  const visible = useMemo(
    () =>
      products.filter(
        (p) =>
          (search ? p.name.toLowerCase().includes(search.toLowerCase()) : p.category === activeCat),
      ),
    [activeCat, search],
  );

  // Recipes + stock for live availability (matches POS)
  const { data: recipes = [] } = useQuery<{ product_id: string; ingredient_id: string; amount: number }[]>({
    queryKey: ["product_recipes", "service"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_recipes").select("product_id, ingredient_id, amount");
      if (error) throw error;
      return (data ?? []) as { product_id: string; ingredient_id: string; amount: number }[];
    },
    refetchInterval: 15000,
  });
  const { data: stockMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["ingredients", "stock"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ingredients").select("id, stock").eq("active", true);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((i) => [i.id as string, Number(i.stock)]));
    },
    refetchInterval: 10000,
  });
  const availability = useMemo(() => {
    const map: Record<string, number> = {};
    const byProduct = new Map<string, { ingredient_id: string; amount: number }[]>();
    for (const r of recipes) {
      if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, []);
      byProduct.get(r.product_id)!.push(r);
    }
    for (const p of products) {
      const recs = byProduct.get(p.id);
      if (!recs || recs.length === 0) { map[p.id] = Infinity; continue; }
      let minServings = Infinity;
      for (const r of recs) {
        const stock = stockMap[r.ingredient_id] ?? 0;
        const serv = r.amount > 0 ? Math.floor(stock / Number(r.amount)) : Infinity;
        if (serv < minServings) minServings = serv;
      }
      map[p.id] = minServings;
    }
    return map;
  }, [recipes, stockMap]);

  const addLine = (p: Product, c: ProductCustomization) =>
    setCart((cur) => {
      if (c.modifiers.length === 0 && !c.note) {
        const ex = cur.find(
          (l) => l.product.id === p.id && l.modifiers.length === 0 && !l.note,
        );
        if (ex) return cur.map((l) => (l.id === ex.id ? { ...l, qty: l.qty + c.qty } : l));
      }
      return [
        ...cur,
        {
          id: `${p.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          product: p,
          qty: c.qty,
          modifiers: c.modifiers,
          note: c.note,
        },
      ];
    });

  const inc = (id: string, d: number) =>
    setCart((c) =>
      c.map((l) => (l.id === id ? { ...l, qty: l.qty + d } : l)).filter((l) => l.qty > 0),
    );

  const total = cart.reduce((s, l) => s + l.product.price * l.qty, 0);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  const reset = () => {
    setStep("tables");
    setSelectedTable(null);
    setCart([]);
    setGuests(2);
    setSearch("");
  };

  return (
    <div className="min-h-screen h-screen flex flex-col bg-background overflow-hidden">
      {/* Header — schlank, immer sichtbar */}
      <header className="glass-strong border-b border-border/40 px-4 py-3 flex items-center gap-3 shrink-0">
        {step !== "tables" && step !== "sent" && (
          <button
            onClick={() => setStep(step === "menu" && activeTableOrder ? "tab" : "tables")}
            className="w-11 h-11 rounded-xl glass flex items-center justify-center tap-highlight-none active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Service
          </div>
          <div className="font-semibold text-lg leading-tight truncate">
            {step === "tables" && "Tisch wählen"}
            {step === "tab" && selectedTable && `Tisch ${selectedTable.name} · Offene Rechnung`}
            {step === "menu" && selectedTable && `Tisch ${selectedTable.name} · ${guests} Gäste`}
            {step === "sent" && "Bestellung gesendet"}
          </div>
        </div>
        {(operator?.role === "manager" || operator?.role === "barkeeper") && (
          <Link
            to="/pos"
            className="hidden md:block text-xs text-muted-foreground hover:text-foreground"
          >
            Kasse →
          </Link>
        )}
      </header>

      <AnimatePresence mode="wait">
        {/* ── TABLES ─────────────────────────────────── */}
        {step === "tables" && (
          <motion.div
            key="tables"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 min-h-0 overflow-hidden flex flex-col p-3 md:p-4 pb-24 md:pb-3"
          >
            <div className="max-w-5xl mx-auto mb-4 flex gap-2 flex-wrap items-center">
              <FilterChip active={areaFilter === "all"} onClick={() => setAreaFilter("all")} label={`Alle (${tables.length})`} />
              {AREAS.map((a) => {
                const Icon = a.icon;
                const n = tables.filter((t) => t.area === a.value).length;
                if (n === 0) return null;
                return (
                  <FilterChip
                    key={a.value}
                    active={areaFilter === a.value}
                    onClick={() => setAreaFilter(a.value)}
                    label={`${a.label} (${n})`}
                    icon={<Icon className="w-3.5 h-3.5" />}
                  />
                );
              })}
              {operator?.role === "manager" && (
                <button
                  onClick={() => setEditLayout((v) => !v)}
                  className={`ml-auto rounded-xl px-3 py-2 text-xs font-medium border-2 transition-all ${
                    editLayout ? "border-success bg-success/10 text-success" : "border-transparent glass text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {editLayout ? "Fertig" : "Position anpassen"}
                </button>
              )}
            </div>

            {/* Mobile: simple grid of table cards (FloorPlan overlaps on small screens) */}
            <div className="md:hidden grid grid-cols-2 gap-2.5">
              {tables
                .filter((t) => areaFilter === "all" || t.area === areaFilter)
                .map((t) => {
                  const openO = orderByTable.get(t.id);
                  const occupied = !!openO;
                  const AreaIcon = AREAS.find((a) => a.value === t.area)!.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTable(t);
                        setStep(openO ? "tab" : "menu");
                      }}
                      className={`relative rounded-2xl p-3 border-2 flex flex-col items-start gap-1 text-left tap-highlight-none transition-colors ${
                        occupied
                          ? "border-emerald-300 bg-emerald-400/20"
                          : "border-white/10 bg-white/[0.04] active:bg-white/[0.08]"
                      }`}
                    >
                      <div className="text-lg font-semibold leading-tight">{t.name}</div>
                      <div className={`text-[10px] uppercase tracking-wider flex items-center gap-1 ${occupied ? "text-emerald-100/90" : "text-muted-foreground"}`}>
                        <AreaIcon className="w-3 h-3" /> {t.seats}P
                      </div>
                      {openO && (
                        <div className="absolute top-2 right-2 rounded-md bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5 tabular-nums shadow-md">
                          {Number(openO.total).toFixed(2)}
                        </div>
                      )}
                    </button>
                  );
                })}
            </div>

            <div className="hidden md:block flex-1 min-h-0">
              <FloorPlan
                tables={tables.filter((t) => areaFilter === "all" || t.area === areaFilter)}
                orderByTable={orderByTable}
                editLayout={editLayout}
                onPickTable={(t, openO) => {
                  setSelectedTable(t);
                  setStep(openO ? "tab" : "menu");
                }}
                onMove={async (id, x, y) => {
                  qc.setQueryData<DiningTable[]>(["dining_tables", "service"], (old) =>
                    (old ?? []).map((x2) => (x2.id === id ? { ...x2, pos_x: x, pos_y: y } : x2)),
                  );
                  await supabase.from("dining_tables").update({ pos_x: x, pos_y: y }).eq("id", id);
                }}
              />
            </div>


            {tablesLoading && (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!tablesLoading && tables.length === 0 && (
              <div className="max-w-5xl mx-auto glass rounded-3xl flex flex-col items-center justify-center text-center py-20 px-6">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">Noch keine Tische eingerichtet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-4">
                  Lege deinen Raumplan unter „Tische" an, um den Service zu starten.
                </p>
                <Link to="/tables" className="rounded-xl px-5 py-2.5 text-sm bg-primary text-primary-foreground font-medium">
                  Zu „Tische"
                </Link>
              </div>
            )}

            {/* Gäste-Auswahl-Hint */}
            <div className="max-w-5xl mx-auto mt-3 glass rounded-2xl p-3 flex items-center gap-4 shrink-0">
              <Users className="w-5 h-5 text-accent shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium">Anzahl Gäste</div>
                <div className="text-xs text-muted-foreground">Wird beim Tisch öffnen übernommen</div>
              </div>
              <div className="flex items-center gap-2 glass rounded-xl p-1">
                <button
                  onClick={() => setGuests((g) => Math.max(1, g - 1))}
                  className="w-10 h-10 rounded-lg flex items-center justify-center active:bg-white/10"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center text-lg font-semibold tabular-nums">{guests}</span>
                <button
                  onClick={() => setGuests((g) => g + 1)}
                  className="w-10 h-10 rounded-lg flex items-center justify-center active:bg-white/10"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── TAB (offene Rechnung) ──────────────────── */}
        {step === "tab" && selectedTable && (
          <motion.div
            key="tab"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 overflow-y-auto p-4 md:p-6 pb-32"
          >
            <div className="max-w-2xl mx-auto">
              <div className="glass-strong rounded-3xl p-5 md:p-6 mb-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Guthaben</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" /> {activeTableOrder?.guests ?? "—"}
                  </div>
                </div>
                <div className="text-4xl md:text-5xl font-semibold tabular-nums">
                  CHF {Number(activeTableOrder?.total ?? 0).toFixed(2)}
                </div>
              </div>

              <div className="glass rounded-3xl p-4 md:p-5 mb-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  Bisher bestellt
                </div>
                {tabLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : tabItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">
                    Noch keine Artikel
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {tabItems.map((it) => (
                      <div key={it.id} className="py-2.5 flex items-start gap-3">
                        <div className="text-sm font-semibold tabular-nums w-7 text-muted-foreground">
                          {it.qty}×
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{it.product_name}</div>
                          {(it.modifiers.length > 0 || it.note) && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {it.modifiers.map((m, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/30">
                                  {m}
                                </span>
                              ))}
                              {it.note && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-muted-foreground border border-border/40 flex items-center gap-1">
                                  <Pencil className="w-2.5 h-2.5" /> {it.note}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-semibold tabular-nums w-20 text-right">
                          {(it.unit_price * it.qty).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => setStep("menu")}
                  className="rounded-2xl py-4 bg-primary text-primary-foreground font-semibold tap-highlight-none active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Weitere Artikel
                </button>
                <button
                  onClick={printInterim}
                  disabled={tabItems.length === 0}
                  className="rounded-2xl py-4 glass font-semibold tap-highlight-none active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Receipt className="w-4 h-4" /> Zwischenrechnung
                </button>
                <button
                  onClick={() => setShowPayChoice(true)}
                  disabled={payTab.isPending || tabItems.length === 0}
                  className="rounded-2xl py-4 bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-semibold tap-highlight-none active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-[var(--shadow-gold)] disabled:opacity-60"
                >
                  {payTab.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  Abschliessen
                </button>
              </div>
            </div>
          </motion.div>
        )}



        {/* ── MENU ───────────────────────────────────── */}
        {step === "menu" && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex min-h-0"
          >
            {/* Categories rail */}
            <nav className="w-24 md:w-36 shrink-0 border-r border-border/40 overflow-y-auto bg-sidebar/40">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setActiveCat(c);
                    setSearch("");
                  }}
                  className={`w-full text-left px-3 md:px-4 py-4 text-xs md:text-sm font-medium border-l-2 transition-all tap-highlight-none ${
                    activeCat === c && !search
                      ? "border-accent bg-white/[0.04] text-foreground"
                      : "border-transparent text-muted-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </nav>

            {/* Products */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="p-3 md:p-4 border-b border-border/40">
                <div className="glass rounded-xl flex items-center gap-2 px-3 py-2.5">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Produkt suchen…"
                    className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-28 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 auto-rows-min">
                {visible.map((p) => {
                  const inCartQty = cart
                    .filter((l) => l.product.id === p.id)
                    .reduce((s, l) => s + l.qty, 0);
                  const left = availability[p.id] ?? Infinity;
                  const oos = left <= 0;
                  const low = !oos && left !== Infinity && left <= 3;
                  return (
                    <motion.button
                      key={p.id}
                      whileTap={oos ? undefined : { scale: 0.97 }}
                      onClick={() => {
                        if (oos) {
                          toast.error(`${p.name} ist ausverkauft — Zutat fehlt im Lager`);
                          return;
                        }
                        setEditing(p);
                      }}
                      disabled={oos}
                      className={`glass rounded-2xl p-4 text-left tap-highlight-none transition-all relative ${
                        oos ? "opacity-40 grayscale cursor-not-allowed" : ""
                      } ${inCartQty > 0 && !oos ? "border-accent/60 shadow-[var(--shadow-gold)]" : ""}`}
                    >
                      {oos && (
                        <span className="absolute top-2 right-2 text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/40">
                          Ausverkauft
                        </span>
                      )}
                      {low && (
                        <span className="absolute top-2 right-2 text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-warning/20 text-warning border border-warning/40">
                          nur {left}
                        </span>
                      )}
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium leading-tight">{p.name}</div>
                          {p.description && (
                            <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                              {p.description}
                            </div>
                          )}
                          {p.meta && (
                            <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                              {p.meta}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-base font-semibold tabular-nums">{p.price.toFixed(2)}</div>
                        </div>
                      </div>
                      {inCartQty > 0 && !oos && !low && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center">
                          {inCartQty}
                        </div>
                      )}
                    </motion.button>
                  );
                })}
                {visible.length === 0 && (
                  <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
                    Keine Treffer
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── SENT ───────────────────────────────────── */}
        {step === "sent" && (
          <motion.div
            key="sent"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex items-center justify-center p-6"
          >
            <div className="text-center max-w-sm">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", damping: 12 }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-accent to-neutral-300 mx-auto flex items-center justify-center shadow-[var(--shadow-gold)] mb-6"
              >
                <Check className="w-12 h-12 text-accent-foreground" strokeWidth={3} />
              </motion.div>
              <h2 className="text-2xl font-semibold mb-2">Bestellung gesendet</h2>
              <p className="text-sm text-muted-foreground mb-8">
                Tisch {selectedTable?.name} · {itemCount} Artikel · CHF {total.toFixed(2)}
                <br />
                Bar & Küche wurden benachrichtigt.
              </p>
              <button
                onClick={reset}
                className="w-full rounded-2xl py-4 bg-primary text-primary-foreground font-semibold tap-highlight-none active:scale-95 transition-transform"
              >
                Nächster Tisch
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky cart bar — sichtbar im menu step */}
      <AnimatePresence>
        {step === "menu" && cart.length > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 250 }}
            className="absolute bottom-0 inset-x-0 z-40"
          >
            <CartSheet
              cart={cart}
              total={total}
              itemCount={itemCount}
              onInc={inc}
              onSend={() => sendOrder.mutate()}
              sending={sendOrder.isPending}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ProductModifierDialog
        product={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onConfirm={(c) => editing && addLine(editing, c)}
      />

      {/* Zwischenrechnung */}
      <AnimatePresence>
        {showInterim && selectedTable && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInterim(false)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="p-5 border-b border-border/40 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Zwischenrechnung</div>
                  <div className="font-semibold text-lg">Tisch {selectedTable.name}</div>
                </div>
                <button onClick={() => setShowInterim(false)} className="w-10 h-10 rounded-xl glass flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-2">
                {tabItems.map((it) => (
                  <div key={it.id} className="flex items-baseline gap-3 text-sm">
                    <span className="tabular-nums w-8 text-muted-foreground">{it.qty}×</span>
                    <span className="flex-1 truncate">{it.product_name}</span>
                    <span className="tabular-nums font-medium">{(it.unit_price * it.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="p-5 border-t border-border/40 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-2xl font-semibold tabular-nums">CHF {Number(activeTableOrder?.total ?? 0).toFixed(2)}</span>
                </div>
                <button
                  onClick={() => { window.print(); }}
                  className="w-full rounded-2xl py-3 glass font-semibold tap-highlight-none active:scale-95 transition-transform"
                >
                  Drucken
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


function CartSheet({
  cart,
  total,
  itemCount,
  onInc,
  onSend,
  sending,
}: {
  cart: CartLine[];
  total: number;
  itemCount: number;
  onInc: (id: string, d: number) => void;
  onSend: () => void;
  sending?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass-strong border-t border-border/40">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="max-h-[40vh] overflow-y-auto p-4 space-y-2">
              {cart.map((l) => (
                <div
                  key={l.id}
                  className="flex items-start gap-3 p-2 rounded-xl bg-white/[0.03]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{l.product.name}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      CHF {l.product.price.toFixed(2)}
                    </div>
                    {(l.modifiers.length > 0 || l.note) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {l.modifiers.map((m) => (
                          <span
                            key={m}
                            className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/30"
                          >
                            {m}
                          </span>
                        ))}
                        {l.note && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-muted-foreground border border-border/40 flex items-center gap-1">
                            <Pencil className="w-2.5 h-2.5" /> {l.note}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 glass rounded-lg p-0.5 shrink-0">
                    <button
                      onClick={() => onInc(l.id, -1)}
                      className="w-9 h-9 rounded-md flex items-center justify-center active:bg-white/10"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-7 text-center text-base font-semibold tabular-nums">
                      {l.qty}
                    </span>
                    <button
                      onClick={() => onInc(l.id, 1)}
                      className="w-9 h-9 rounded-md flex items-center justify-center active:bg-white/10"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-sm font-semibold tabular-nums w-16 text-right shrink-0">
                    {(l.product.price * l.qty).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="glass rounded-xl px-4 py-3 flex items-center gap-2 tap-highlight-none active:scale-95 transition-transform"
        >
          <ShoppingBag className="w-4 h-4" />
          <span className="font-semibold tabular-nums">{itemCount}</span>
          <ChevronRight className={`w-4 h-4 transition-transform ${open ? "rotate-90" : "-rotate-90"}`} />
        </button>
        <div className="flex-1 text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
          <div className="text-xl font-semibold tabular-nums">CHF {total.toFixed(2)}</div>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onSend}
          disabled={sending}
          className="rounded-2xl px-5 md:px-7 py-3.5 bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-semibold shadow-[var(--shadow-gold)] flex items-center gap-2 tap-highlight-none disabled:opacity-60"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Sendet…" : "Senden"}
        </motion.button>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-xs flex items-center gap-1.5 border-2 transition-all ${
        active
          ? "border-accent bg-accent/10 text-foreground"
          : "border-transparent glass text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

type FloorElement = {
  id: string;
  kind: string;
  shape: "rect" | "rounded" | "round" | "l_shape" | "l_mirror" | "l_flip" | "l_flipmirror" | "u_shape" | "t_shape";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label: string | null;
  color: string | null;
  z_index: number;
  points?: { x: number; y: number }[] | null;
};

const SHAPE_POINTS: Record<FloorElement["shape"], { x: number; y: number }[]> = {
  rect: [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],
  rounded: [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],
  round: [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],
  l_shape: [{x:0,y:0},{x:100,y:0},{x:100,y:45},{x:45,y:45},{x:45,y:100},{x:0,y:100}],
  l_mirror: [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:55,y:100},{x:55,y:45},{x:0,y:45}],
  l_flip: [{x:0,y:55},{x:55,y:55},{x:55,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],
  l_flipmirror: [{x:0,y:0},{x:45,y:0},{x:45,y:55},{x:100,y:55},{x:100,y:100},{x:0,y:100}],
  u_shape: [{x:0,y:0},{x:30,y:0},{x:30,y:70},{x:70,y:70},{x:70,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],
  t_shape: [{x:0,y:0},{x:100,y:0},{x:100,y:40},{x:65,y:40},{x:65,y:100},{x:35,y:100},{x:35,y:40},{x:0,y:40}],
};

type Interaction =
  | null
  | { kind: "table"; id: string; mode: "move" }
  | { kind: "element"; id: string; mode: "move"; offX: number; offY: number; startX: number; startY: number }
  | { kind: "element"; id: string; mode: "resize"; startW: number; startH: number; startPx: number; startPy: number }
  | { kind: "element"; id: string; mode: "rotate"; cx: number; cy: number; startAngle: number; startRot: number }
  | { kind: "vertex"; id: string; index: number };

function FloorPlan({
  tables,
  orderByTable,
  editLayout,
  onPickTable,
  onMove,
}: {
  tables: DiningTable[];
  orderByTable: Map<string, OpenOrder>;
  editLayout: boolean;
  onPickTable: (t: DiningTable, openO: OpenOrder | undefined) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const qc = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [interaction, setInteraction] = useState<Interaction>(null);
  const [selectedElId, setSelectedElId] = useState<string | null>(null);

  const { data: elements = [] } = useQuery<FloorElement[]>({
    queryKey: ["floor_elements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("floor_elements")
        .select("id, kind, shape, x, y, width, height, rotation, label, color, z_index")
        .order("z_index");
      if (error) throw error;
      return (data ?? []) as FloorElement[];
    },
  });

  const patchElement = async (id: string, patch: Partial<FloorElement>) => {
    qc.setQueryData<FloorElement[]>(["floor_elements"], (old) =>
      (old ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
    await supabase.from("floor_elements").update(patch).eq("id", id);
  };

  const addElement = async (preset: "bar" | "wall" | "pillar" | "entrance" | "terrace" | "room") => {
    const base: Partial<FloorElement> =
      preset === "bar"
        ? { kind: "bar", shape: "rounded", x: 50, y: 15, width: 60, height: 12, label: "Bar", color: "#f5c46b" }
        : preset === "wall"
        ? { kind: "wall", shape: "rect", x: 50, y: 50, width: 30, height: 3, label: null, color: "#3a3a3a" }
        : preset === "entrance"
        ? { kind: "entrance", shape: "rect", x: 50, y: 96, width: 14, height: 3, label: "Eingang", color: "#8a8a8a" }
        : preset === "terrace"
        ? { kind: "terrace", shape: "rounded", x: 75, y: 92, width: 28, height: 14, label: "Terrasse", color: "#6ba37a" }
        : preset === "room"
        ? { kind: "room", shape: "rounded", x: 50, y: 50, width: 92, height: 88, label: null, color: "#ffffff", z_index: -1 }
        : { kind: "pillar", shape: "round", x: 50, y: 50, width: 6, height: 6, label: null, color: "#2a2a2a" };
    const { data, error } = await supabase.from("floor_elements").insert(base).select().single();
    if (error) {
      toast.error("Konnte Element nicht erstellen");
      return;
    }
    qc.setQueryData<FloorElement[]>(["floor_elements"], (old) => [...(old ?? []), data as FloorElement]);
    setSelectedElId((data as FloorElement).id);
  };

  const deleteElement = async (id: string) => {
    qc.setQueryData<FloorElement[]>(["floor_elements"], (old) => (old ?? []).filter((e) => e.id !== id));
    setSelectedElId(null);
    await supabase.from("floor_elements").delete().eq("id", id);
  };

  const fallbackPos = (t: DiningTable, i: number) => {
    if (t.pos_x != null && t.pos_y != null) return { x: t.pos_x, y: t.pos_y };
    const cols = 6;
    return {
      x: 12 + (i % cols) * 13,
      y: t.area === "bar" ? 28 : 45 + Math.floor(i / cols) * 20,
    };
  };

  const getPct = (e: React.PointerEvent | PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      px: ((e.clientX - rect.left) / rect.width) * 100,
      py: ((e.clientY - rect.top) / rect.height) * 100,
      rect,
    };
  };

  const startTableMove = (e: React.PointerEvent, id: string) => {
    if (!editLayout) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setInteraction({ kind: "table", id, mode: "move" });
  };

  const startElementMove = (e: React.PointerEvent, el: FloorElement) => {
    if (!editLayout) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelectedElId(el.id);
    const { px, py } = getPct(e);
    setInteraction({
      kind: "element",
      id: el.id,
      mode: "move",
      offX: px - el.x,
      offY: py - el.y,
      startX: el.x,
      startY: el.y,
    });
  };

  const startElementResize = (e: React.PointerEvent, el: FloorElement) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const { px, py } = getPct(e);
    setInteraction({ kind: "element", id: el.id, mode: "resize", startW: el.width, startH: el.height, startPx: px, startPy: py });
  };

  const startElementRotate = (e: React.PointerEvent, el: FloorElement) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = rect.left + (el.x / 100) * rect.width;
    const cy = rect.top + (el.y / 100) * rect.height;
    const startAngle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
    setInteraction({ kind: "element", id: el.id, mode: "rotate", cx, cy, startAngle, startRot: el.rotation });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!interaction || !canvasRef.current) return;
    if (interaction.kind === "table") {
      const { px, py } = getPct(e);
      onMove(interaction.id, Math.round(Math.max(4, Math.min(96, px)) * 10) / 10, Math.round(Math.max(4, Math.min(96, py)) * 10) / 10);
      return;
    }
    if (interaction.kind === "vertex") {
      const el = elements.find((x) => x.id === interaction.id);
      if (!el || !el.points) return;
      const { px, py } = getPct(e);
      // convert canvas pct -> element-local pct (0..100 within bounding box)
      const leftPct = el.x - el.width / 2;
      const topPct = el.y - el.height / 2;
      const localX = el.width > 0 ? ((px - leftPct) / el.width) * 100 : 0;
      const localY = el.height > 0 ? ((py - topPct) / el.height) * 100 : 0;
      const nx = Math.max(0, Math.min(100, localX));
      const ny = Math.max(0, Math.min(100, localY));
      const newPoints = el.points.map((p, i) =>
        i === interaction.index ? { x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 } : p,
      );
      patchElement(el.id, { points: newPoints });
      return;
    }
    if (interaction.kind === "element") {
      const el = elements.find((x) => x.id === interaction.id);
      if (!el) return;
      if (interaction.mode === "move") {
        const { px, py } = getPct(e);
        const nx = Math.max(0, Math.min(100, px - interaction.offX));
        const ny = Math.max(0, Math.min(100, py - interaction.offY));
        patchElement(el.id, { x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 });
      } else if (interaction.mode === "resize") {
        const { px, py } = getPct(e);
        const dW = (px - interaction.startPx) * 2;
        const dH = (py - interaction.startPy) * 2;
        const isRound = el.shape === "round";
        const newW = Math.max(3, Math.min(100, interaction.startW + dW));
        const newH = isRound ? newW : Math.max(2, Math.min(100, interaction.startH + dH));
        patchElement(el.id, { width: Math.round(newW * 10) / 10, height: Math.round(newH * 10) / 10 });
      } else if (interaction.mode === "rotate") {
        const angle = (Math.atan2(e.clientY - interaction.cy, e.clientX - interaction.cx) * 180) / Math.PI;
        let next = interaction.startRot + (angle - interaction.startAngle);
        next = Math.round(next);
        if (e.shiftKey) next = Math.round(next / 15) * 15;
        patchElement(el.id, { rotation: next });
      }
    }
  };

  const handlePointerUp = () => setInteraction(null);

  const startVertexDrag = (e: React.PointerEvent, el: FloorElement, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setInteraction({ kind: "vertex", id: el.id, index });
  };

  const enableCorners = (el: FloorElement) => {
    if (el.points && el.points.length >= 3) return;
    patchElement(el.id, { points: SHAPE_POINTS[el.shape].map((p) => ({ ...p })) });
  };

  const removeVertex = (el: FloorElement, index: number) => {
    if (!el.points || el.points.length <= 3) return;
    patchElement(el.id, { points: el.points.filter((_, i) => i !== index) });
  };

  const addVertexAfter = (el: FloorElement, index: number) => {
    if (!el.points) return;
    const a = el.points[index];
    const b = el.points[(index + 1) % el.points.length];
    const mid = { x: Math.round(((a.x + b.x) / 2) * 10) / 10, y: Math.round(((a.y + b.y) / 2) * 10) / 10 };
    const next = [...el.points];
    next.splice(index + 1, 0, mid);
    patchElement(el.id, { points: next });
  };

  const cycleShape = (el: FloorElement) => {
    const order: FloorElement["shape"][] = ["rounded", "rect", "round", "l_shape", "l_mirror", "l_flip", "l_flipmirror", "u_shape", "t_shape"];
    const next = order[(order.indexOf(el.shape) + 1) % order.length];
    const patch: Partial<FloorElement> = { shape: next, points: null };
    if (next === "round") patch.height = el.width;
    patchElement(el.id, patch);
  };

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col min-h-0">
      {editLayout && (
        <div className="mb-3 flex flex-wrap gap-2 items-center">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-2">Element hinzufügen</span>
          <button onClick={() => addElement("room")} className="rounded-lg px-3 py-1.5 text-xs glass border border-white/15 text-foreground hover:bg-white/10 flex items-center gap-1.5">
            <Plus className="w-3 h-3" /> Raum
          </button>
          <button onClick={() => addElement("bar")} className="rounded-lg px-3 py-1.5 text-xs glass border border-amber-300/30 text-amber-200 hover:bg-amber-200/10 flex items-center gap-1.5">
            <Plus className="w-3 h-3" /> Bar
          </button>
          <button onClick={() => addElement("wall")} className="rounded-lg px-3 py-1.5 text-xs glass border border-white/10 text-muted-foreground hover:text-foreground flex items-center gap-1.5">
            <Plus className="w-3 h-3" /> Wand
          </button>
          <button onClick={() => addElement("pillar")} className="rounded-lg px-3 py-1.5 text-xs glass border border-white/10 text-muted-foreground hover:text-foreground flex items-center gap-1.5">
            <Plus className="w-3 h-3" /> Säule
          </button>
          <button onClick={() => addElement("entrance")} className="rounded-lg px-3 py-1.5 text-xs glass border border-white/15 text-muted-foreground hover:text-foreground flex items-center gap-1.5">
            <Plus className="w-3 h-3" /> Eingang
          </button>
        </div>
      )}
      <div
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={() => setSelectedElId(null)}
        className={`relative w-full flex-1 min-h-0 rounded-3xl border border-white/[0.06] overflow-hidden select-none ${
          editLayout ? "ring-2 ring-accent/30" : ""
        }`}
        style={{
          background:
            "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.04), transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.03), transparent 50%), repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 40px), #0a0a0a",
          touchAction: "none",
        }}
      >
        {/* Floor elements (bar, walls, pillars) */}
        {elements.map((el) => {
          const selected = selectedElId === el.id;
          const accent = el.color || "#f5c46b";
          const hasCustomPoints = Array.isArray(el.points) && el.points.length >= 3;
          const radius = hasCustomPoints
            ? "0"
            : el.shape === "round" ? "9999px" : el.shape === "rounded" ? "16px" : el.shape === "rect" ? "4px" : "12px";
          const clipPath = hasCustomPoints
            ? `polygon(${el.points!.map((p) => `${p.x}% ${p.y}%`).join(", ")})`
            : el.shape === "l_shape" ? "polygon(0 0, 100% 0, 100% 45%, 45% 45%, 45% 100%, 0 100%)"
            : el.shape === "l_mirror" ? "polygon(0 0, 100% 0, 100% 100%, 55% 100%, 55% 45%, 0 45%)"
            : el.shape === "l_flip" ? "polygon(0 55%, 55% 55%, 55% 0, 100% 0, 100% 100%, 0 100%)"
            : el.shape === "l_flipmirror" ? "polygon(0 0, 45% 0, 45% 55%, 100% 55%, 100% 100%, 0 100%)"
            : el.shape === "u_shape" ? "polygon(0 0, 30% 0, 30% 70%, 70% 70%, 70% 0, 100% 0, 100% 100%, 0 100%)"
            : el.shape === "t_shape" ? "polygon(0 0, 100% 0, 100% 40%, 65% 40%, 65% 100%, 35% 100%, 35% 40%, 0 40%)"
            : undefined;
          return (
            <div
              key={el.id}
              onPointerDown={(e) => startElementMove(e, el)}
              onClick={(e) => {
                if (!editLayout) return;
                e.stopPropagation();
                setSelectedElId(el.id);
              }}
              className={`absolute flex items-center justify-center ${editLayout ? "cursor-grab active:cursor-grabbing" : ""}`}
              style={{
                left: `${el.x}%`,
                top: `${el.y}%`,
                width: `${el.width}%`,
                height: `${el.height}%`,
                transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
                zIndex: el.kind === "room" ? 0 : 2,
              }}
            >
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  borderRadius: radius,
                  clipPath,
                  background: el.kind === "room"
                    ? "transparent"
                    : `linear-gradient(180deg, color-mix(in oklab, ${accent} 22%, transparent), color-mix(in oklab, ${accent} 10%, transparent))`,
                  border: el.kind === "room"
                    ? `2px solid color-mix(in oklab, ${accent} 25%, transparent)`
                    : `1px solid color-mix(in oklab, ${accent} 45%, transparent)`,
                  boxShadow: selected
                    ? `0 0 0 2px ${accent}, 0 8px 30px -8px color-mix(in oklab, ${accent} 60%, transparent)`
                    : el.kind === "room"
                    ? `inset 0 0 80px color-mix(in oklab, ${accent} 8%, transparent)`
                    : `inset 0 1px 0 color-mix(in oklab, ${accent} 30%, transparent)`,
                }}
              >
                {el.label && (
                  <span
                    className="text-[10px] tracking-[0.3em] uppercase pointer-events-none"
                    style={{ color: `color-mix(in oklab, ${accent} 90%, white)` }}
                  >
                    {el.label}
                  </span>
                )}
              </div>

              {editLayout && selected && (
                <>
                  {/* Vertex handles when custom corners exist */}
                  {hasCustomPoints && el.points!.map((p, i) => {
                    const next = el.points![(i + 1) % el.points!.length];
                    const mid = { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
                    return (
                      <div key={`v-${i}`}>
                        {/* Midpoint "+" button to insert a corner */}
                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); addVertexAfter(el, i); }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-background/90 border border-accent/60 text-accent text-[10px] leading-none flex items-center justify-center hover:bg-accent hover:text-accent-foreground z-30"
                          style={{ left: `${mid.x}%`, top: `${mid.y}%`, transform: `translate(-50%, -50%) rotate(${-el.rotation}deg)` }}
                          title="Ecke einfügen"
                        >
                          +
                        </button>
                        {/* Corner handle */}
                        <div
                          onPointerDown={(e) => startVertexDrag(e, el, i)}
                          onDoubleClick={(e) => { e.stopPropagation(); removeVertex(el, i); }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-accent border-2 border-background cursor-grab active:cursor-grabbing z-30"
                          style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%, -50%) rotate(${-el.rotation}deg)` }}
                          title="Ecke ziehen · Doppelklick zum Entfernen"
                        />
                      </div>
                    );
                  })}
                  {/* Resize handle (hidden when editing corners) */}
                  {!hasCustomPoints && (
                    <div
                      onPointerDown={(e) => startElementResize(e, el)}
                      className="absolute -right-2 -bottom-2 w-5 h-5 rounded-md bg-accent border-2 border-background cursor-nwse-resize z-30"
                      title="Größe ändern"
                    />
                  )}
                  {/* Rotate handle */}
                  <div
                    onPointerDown={(e) => startElementRotate(e, el)}
                    className="absolute left-1/2 -top-7 -translate-x-1/2 w-6 h-6 rounded-full bg-accent border-2 border-background cursor-grab z-30 flex items-center justify-center"
                    title="Drehen"
                  >
                    <RotateCw className="w-3 h-3 text-accent-foreground" />
                  </div>
                  {/* Toolbar */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -bottom-10 flex gap-1 z-30"
                    style={{ transform: `translateX(-50%) rotate(${-el.rotation}deg)` }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => cycleShape(el)}
                      className="rounded-md px-2 py-1 text-[10px] bg-background/90 border border-white/15 flex items-center gap-1 hover:bg-background"
                    >
                      <Shapes className="w-3 h-3" /> Form
                    </button>
                    <button
                      onClick={() => enableCorners(el)}
                      className={`rounded-md px-2 py-1 text-[10px] border border-white/15 flex items-center gap-1 hover:bg-background ${hasCustomPoints ? "bg-accent/20 text-accent" : "bg-background/90"}`}
                      title="Ecken einzeln bearbeiten"
                    >
                      <Move className="w-3 h-3" /> Ecken
                    </button>
                    <button
                      onClick={() => deleteElement(el.id)}
                      className="rounded-md px-2 py-1 text-[10px] bg-destructive/90 text-destructive-foreground flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}




        {/* Tables */}
        {tables.map((t, i) => {
          const { x, y } = fallbackPos(t, i);
          const openO = orderByTable.get(t.id);
          const occupied = !!openO;
          const AreaIcon = AREAS.find((a) => a.value === t.area)!.icon;
          const isRound = t.area === "bar";
          const size = Math.max(56, Math.min(92, 48 + (t.seats ?? 2) * 6));
          const isDragging = interaction?.kind === "table" && interaction.id === t.id;
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              onPointerDown={(e) => startTableMove(e, t.id)}
              onClick={(e) => {
                if (editLayout || interaction) {
                  e.preventDefault();
                  return;
                }
                onPickTable(t, openO);
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-0.5 transition-colors tap-highlight-none ${
                isRound ? "rounded-full" : "rounded-2xl"
              } border-2 ${
                occupied
                  ? "border-emerald-300 bg-emerald-400/25 shadow-[0_0_24px_rgba(74,222,128,0.55),inset_0_0_18px_rgba(134,239,172,0.35)]"
                  : "border-white/15 bg-white/[0.04] hover:border-accent/60"
              } ${editLayout ? "cursor-grab active:cursor-grabbing ring-2 ring-accent/40" : ""} ${
                isDragging ? "z-20 scale-105" : "z-10"
              }`}
              style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, touchAction: "none" }}
            >
              <div className="text-xl font-semibold tracking-tight leading-none">{t.name}</div>
              <div className={`text-[9px] uppercase tracking-wider flex items-center gap-0.5 ${occupied ? "text-emerald-100/90" : "text-muted-foreground"}`}>
                <AreaIcon className="w-2.5 h-2.5" /> {t.seats}P
              </div>
              {openO && (
                <div className="absolute -top-2 -right-2 rounded-md bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5 tabular-nums shadow-md">
                  {Number(openO.total).toFixed(2)}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
      {editLayout && (
        <p className="text-center text-xs text-muted-foreground mt-3">
          Alles frei verschiebbar · Eckpunkt = Größe · oberer Knopf = drehen · auf Element tippen für Form &amp; Löschen
        </p>
      )}
    </div>
  );
}
