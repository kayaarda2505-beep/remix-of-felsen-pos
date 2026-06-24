import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Minus,
  Plus,
  Trash2,
  CreditCard,
  Banknote,
  Search,
  Percent,
  Pencil,
  Users,
  Clock,
  Loader2,
  CheckCircle2,
  X,
  Maximize2,
  Minimize2,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useProducts, type Product } from "@/hooks/use-products";
import { supabase } from "@/integrations/supabase/client";
import { ProductModifierDialog, type ProductCustomization } from "@/components/ProductModifierDialog";
import { printBill, printCardReceipt, type ReceiptItem } from "@/lib/receipt";
import { isDesktopApp, type PrinterConfig } from "@/lib/printer-bridge";
import { sumupSendToReader, sumupGetTransactionStatus, sumupListReaders } from "@/lib/sumup.functions";

export const Route = createFileRoute("/pos")({
  head: () => ({ meta: [{ title: "Kasse — SAINTS POS" }] }),
  component: POS,
});

interface OpenOrder {
  id: string;
  table_id: string | null;
  guests: number | null;
  total: number;
  opened_at: string;
  dining_tables: { name: string; area: string } | null;
}
interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  qty: number;
  modifiers: string[];
  note: string | null;
}
interface LocalLine {
  id: string;
  product: Product;
  qty: number;
  modifiers: string[];
  note?: string;
}

function POS() {
  const qc = useQueryClient();
  const { operator } = useAuth();
  const canVoid = operator?.role === "manager";
  const { products, categories } = useProducts();
  const [activeCat, setActiveCat] = useState<string>("Cocktails");
  const [search, setSearch] = useState("");
  const [tip, setTip] = useState(0);
  const [editing, setEditing] = useState<Product | null>(null);
  // null = walk-in (Theke), otherwise an order id
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [walkInCart, setWalkInCart] = useState<LocalLine[]>([]);
  const [payMode, setPayMode] = useState<null | "cash" | "card">(null);

  const { data: openOrders = [] } = useQuery<OpenOrder[]>({
    queryKey: ["orders", "open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, table_id, guests, total, opened_at, dining_tables(name, area)")
        .eq("status", "open")
        .order("opened_at");
      if (error) throw error;
      return (data ?? []) as unknown as OpenOrder[];
    },
    refetchInterval: 5000,
  });

  const { data: tabItems = [], isLoading: tabLoading } = useQuery<OrderItem[]>({
    queryKey: ["order_items", activeOrderId],
    enabled: !!activeOrderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, product_id, product_name, unit_price, qty, modifiers, note")
        .eq("order_id", activeOrderId!)
        .order("sent_at");
      if (error) throw error;
      return (data ?? []) as unknown as OrderItem[];
    },
  });

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

  // Recipes + stock for live availability
  const { data: recipes = [] } = useQuery<{ product_id: string; ingredient_id: string; amount: number }[]>({
    queryKey: ["product_recipes", "pos"],
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

  // For each product → how many can we still make (Infinity = no recipe = always available)
  const availability = useMemo(() => {
    const map: Record<string, number> = {};
    const byProduct = new Map<string, { ingredient_id: string; amount: number }[]>();
    for (const r of recipes) {
      if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, []);
      byProduct.get(r.product_id)!.push(r);
    }
    for (const p of products) {
      const recs = byProduct.get(p.id);
      if (!recs || recs.length === 0) {
        map[p.id] = Infinity;
        continue;
      }
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

  const activeOrder = openOrders.find((o) => o.id === activeOrderId) ?? null;

  const visible = useMemo(
    () =>
      products.filter(
        (p) =>
          p.category === activeCat &&
          (search === "" || p.name.toLowerCase().includes(search.toLowerCase())),
      ),
    [activeCat, search],
  );

  // Walk-in helpers
  const addWalkIn = (p: Product, c: ProductCustomization) =>
    setWalkInCart((cur) => {
      if (c.modifiers.length === 0 && !c.note) {
        const ex = cur.find((l) => l.product.id === p.id && l.modifiers.length === 0 && !l.note);
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
  const incWalkIn = (id: string, d: number) =>
    setWalkInCart((c) =>
      c.map((l) => (l.id === id ? { ...l, qty: l.qty + d } : l)).filter((l) => l.qty > 0),
    );

  // Tab helpers
  const addToTab = useMutation({
    mutationFn: async ({ p, c }: { p: Product; c: ProductCustomization }) => {
      if (!activeOrderId) return;
      const { error } = await supabase.from("order_items").insert({
        order_id: activeOrderId,
        product_id: p.id,
        product_name: p.name,
        category: p.category,
        unit_price: p.price,
        qty: c.qty,
        modifiers: c.modifiers,
        note: c.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order_items", activeOrderId] });
      qc.invalidateQueries({ queryKey: ["orders", "open"] });
      qc.invalidateQueries({ queryKey: ["ingredients", "stock"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const updateTabQty = useMutation({
    mutationFn: async ({ itemId, qty }: { itemId: string; qty: number }) => {
      if (qty <= 0) {
        const { error } = await supabase.from("order_items").delete().eq("id", itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("order_items").update({ qty }).eq("id", itemId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order_items", activeOrderId] });
      qc.invalidateQueries({ queryKey: ["orders", "open"] });
      qc.invalidateQueries({ queryKey: ["ingredients", "stock"] });
    },
  });

  const payTab = useMutation({
    mutationFn: async ({ method }: { method: string }) => {
      if (!activeOrderId || !activeOrder) return;
      const tableName = activeOrder.dining_tables?.name ?? "Theke";
      const items: ReceiptItem[] = tabItems.map((it) => ({
        product_name: it.product_name,
        qty: it.qty,
        unit_price: Number(it.unit_price),
        modifiers: it.modifiers,
      }));
      if (isDesktopApp()) {
        const err = await printBill({
          printers,
          tableName,
          items,
          total: Number(activeOrder.total) + tip,
          paymentMethod: method,
        });
        if (err) toast.error(`Druck: ${err}`);
      }
      const { error } = await supabase
        .from("orders")
        .update({ status: "paid", closed_at: new Date().toISOString() })
        .eq("id", activeOrderId);
      if (error) throw error;
      if (activeOrder.table_id) {
        await supabase
          .from("dining_tables")
          .update({ status: "free", opened_at: null, guests: null })
          .eq("id", activeOrder.table_id);
      }
      toast.success(`Bezahlt mit ${method}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", "open"] });
      qc.invalidateQueries({ queryKey: ["dining_tables"] });
      setActiveOrderId(null);
      setTip(0);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const payWalkIn = useMutation({
    mutationFn: async ({ method }: { method: string }) => {
      if (walkInCart.length === 0) return;
      const { data: order, error: oErr } = await supabase
        .from("orders")
        .insert({ status: "open", guests: 1 })
        .select("id")
        .single();
      if (oErr || !order) throw oErr ?? new Error("order");
      const rows = walkInCart.map((l) => ({
        order_id: order.id,
        product_id: l.product.id,
        product_name: l.product.name,
        category: l.product.category,
        unit_price: l.product.price,
        qty: l.qty,
        modifiers: l.modifiers,
        note: l.note ?? null,
      }));
      const { error: iErr } = await supabase.from("order_items").insert(rows);
      if (iErr) throw iErr;
      const totalAmt =
        walkInCart.reduce((s, l) => s + l.product.price * l.qty, 0) + tip;
      const { error: uErr } = await supabase
        .from("orders")
        .update({ status: "paid", closed_at: new Date().toISOString(), total: totalAmt })
        .eq("id", order.id);
      if (uErr) throw uErr;
      if (isDesktopApp()) {
        const items: ReceiptItem[] = walkInCart.map((l) => ({
          product_name: l.product.name,
          qty: l.qty,
          unit_price: l.product.price,
          category: l.product.category,
          modifiers: l.modifiers,
          note: l.note ?? null,
        }));
        const err = await printBill({
          printers,
          tableName: "Theke",
          items,
          total: totalAmt,
          tip,
          paymentMethod: method,
        });
        if (err) toast.error(`Druck: ${err}`);
      }
      await supabase.from("payment_requests").insert({
        order_id: order.id,
        table_name: "Theke",
        amount: totalAmt,
        method: method.toLowerCase().includes("twint") ? "twint" : method.toLowerCase() === "bar" ? "cash" : "card_terminal",
        status: "paid",
        handled_at: new Date().toISOString(),
        note: `Theke · ${method}`,
      });
      toast.success(`Bezahlt mit ${method}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders_range"] });
      qc.invalidateQueries({ queryKey: ["items_range"] });
      qc.invalidateQueries({ queryKey: ["payments_range"] });
      setWalkInCart([]);
      setTip(0);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const isTab = !!activeOrderId;
  const subtotal = isTab
    ? tabItems.reduce((s, l) => s + l.unit_price * l.qty, 0)
    : walkInCart.reduce((s, l) => s + l.product.price * l.qty, 0);
  const total = subtotal + tip;
  const showCart = isTab ? tabItems : walkInCart;

  // Vollbild-Toggle (F11-Ersatz, blendet die Windows-Taskleiste aus)
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== "undefined" && !!document.fullscreenElement,
  );
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      /* ignored */
    }
  };

  // Zwischenrechnung drucken (vor dem Bezahlen-Dialog)
  const printInterim = async () => {
    if (!isDesktopApp()) return;
    const tableName = isTab ? activeOrder?.dining_tables?.name ?? "Tisch" : "Theke";
    const items: ReceiptItem[] = isTab
      ? tabItems.map((it) => ({
          product_name: it.product_name,
          qty: it.qty,
          unit_price: Number(it.unit_price),
          modifiers: it.modifiers,
        }))
      : walkInCart.map((l) => ({
          product_name: l.product.name,
          qty: l.qty,
          unit_price: l.product.price,
          modifiers: l.modifiers,
          note: l.note ?? null,
        }));
    if (items.length === 0) return;
    const err = await printBill({
      printers,
      tableName,
      items,
      subtotal,
      total,
      tip,
      interim: true,
    });
    if (err) toast.error(`Druck: ${err}`);
  };

  const handlePay = async () => {
    await printInterim();
    setPayMode("cash");
  };

  const handleProductTap = (p: Product) => {
    const left = availability[p.id] ?? Infinity;
    if (left <= 0) {
      toast.error(`${p.name} ist ausverkauft — Zutat fehlt im Lager`);
      return;
    }
    setEditing(p);
  };

  if (operator && operator.role !== "manager" && operator.role !== "barkeeper") {
    return (
      <div className="p-6 h-screen flex items-center justify-center">
        <div className="glass-strong rounded-3xl p-10 max-w-md text-center">
          <h1 className="text-xl font-semibold mb-2">Kein Zugriff</h1>
          <p className="text-sm text-muted-foreground">
            Die Kasse ist nur für Manager und Barkeeper verfügbar. Bitte nutze den Service-Bereich.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 lg:p-4 pb-24 md:pb-3 h-screen flex flex-col w-full max-w-[1800px] mx-auto overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <PageHeader title="Kasse" subtitle={isTab && activeOrder ? `Tisch ${activeOrder.dining_tables?.name ?? "?"} · offen` : "Theke / Walk-in"} />
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Vollbild verlassen" : "Vollbild (Taskleiste ausblenden)"}
          className="glass rounded-xl p-2 hover:border-accent/40 transition-colors shrink-0"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Open tabs row */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          onClick={() => setActiveOrderId(null)}
          className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium border-2 transition-all ${
            !isTab ? "border-accent bg-accent/10 text-foreground" : "border-transparent glass text-muted-foreground"
          }`}
        >
          Theke
        </button>
        {openOrders.map((o) => (
          <button
            key={o.id}
            onClick={() => setActiveOrderId(o.id)}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium border-2 transition-all flex items-center gap-2 ${
              activeOrderId === o.id ? "border-accent bg-accent/10 text-foreground" : "border-transparent glass text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="font-semibold">Tisch {o.dining_tables?.name ?? "?"}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" /> {o.guests ?? 0}
            </span>
            <span className="text-xs tabular-nums text-accent">CHF {Number(o.total).toFixed(2)}</span>
          </button>
        ))}
        {openOrders.length === 0 && (
          <div className="text-xs text-muted-foreground self-center px-2">Keine offenen Tische</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-3 lg:gap-4 flex-1 min-h-0 min-w-0">
        {/* Product grid */}
        <div className="flex flex-col min-h-0 min-w-0 gap-4">

          <div className="flex items-center gap-3">
            <div className="glass rounded-xl flex items-center gap-2 px-3 py-2 flex-1 max-w-xs">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Produkt suchen…"
                className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all tap-highlight-none ${
                  activeCat === c
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "glass text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 overflow-y-auto pr-1 -mr-1 pb-2">
            <AnimatePresence mode="popLayout">
              {visible.map((p) => {
                const left = availability[p.id] ?? Infinity;
                const oos = left <= 0;
                const low = !oos && left !== Infinity && left <= 3;
                return (
                  <motion.button
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileTap={oos ? undefined : { scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => handleProductTap(p)}
                    disabled={oos}
                    className={`glass rounded-2xl p-4 text-left min-h-28 flex flex-col justify-between relative overflow-hidden transition-colors ${
                      oos
                        ? "opacity-40 grayscale cursor-not-allowed"
                        : "hover:border-accent/40"
                    }`}
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
                    <div>
                      <div className="text-sm font-medium leading-tight">{p.name}</div>
                      {p.meta && (
                        <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                          {p.meta}
                        </div>
                      )}
                    </div>
                    <div className="text-base font-semibold tabular-nums mt-2">
                      CHF {p.price.toFixed(2)}
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Cart */}
        <aside className="glass-strong rounded-3xl p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">{isTab ? `Tab Tisch ${activeOrder?.dining_tables?.name ?? ""}` : "Bestellung"}</h3>
              {isTab && activeOrder?.opened_at && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  geöffnet {new Date(activeOrder.opened_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
            {!isTab && walkInCart.length > 0 && (
              <button
                onClick={() => setWalkInCart([])}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Leeren
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-2 min-h-32">
            {isTab && tabLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {showCart.length === 0 && !tabLoading && (
              <div className="text-center text-sm text-muted-foreground py-12">
                {isTab ? "Noch keine Artikel auf diesem Tisch" : "Tippe Produkte zum Hinzufügen"}
              </div>
            )}
            <AnimatePresence initial={false}>
              {isTab
                ? tabItems.map((l) => (
                    <motion.div
                      key={l.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-start gap-3 p-2 rounded-xl bg-white/[0.03]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{l.product_name}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          CHF {Number(l.unit_price).toFixed(2)}
                        </div>
                        {(l.modifiers.length > 0 || l.note) && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {l.modifiers.map((m) => (
                              <span key={m} className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/30">
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
                          onClick={() => {
                            if (!canVoid) {
                              toast.error("Storno nur durch Manager");
                              return;
                            }
                            updateTabQty.mutate({ itemId: l.id, qty: l.qty - 1 });
                          }}
                          disabled={!canVoid}
                          title={canVoid ? "Menge reduzieren" : "Storno nur durch Manager"}
                          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-sm tabular-nums">{l.qty}</span>
                        <button
                          onClick={() => updateTabQty.mutate({ itemId: l.id, qty: l.qty + 1 })}
                          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-sm font-semibold tabular-nums w-16 text-right shrink-0">
                        {(Number(l.unit_price) * l.qty).toFixed(2)}
                      </div>
                    </motion.div>
                  ))
                : walkInCart.map((l) => (
                    <motion.div
                      key={l.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-start gap-3 p-2 rounded-xl bg-white/[0.03]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{l.product.name}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          CHF {l.product.price.toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 glass rounded-lg p-0.5 shrink-0">
                        <button onClick={() => incWalkIn(l.id, -1)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-sm tabular-nums">{l.qty}</span>
                        <button onClick={() => incWalkIn(l.id, 1)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-sm font-semibold tabular-nums w-16 text-right shrink-0">
                        {(l.product.price * l.qty).toFixed(2)}
                      </div>
                    </motion.div>
                  ))}
            </AnimatePresence>
          </div>

          <div className="border-t border-border/40 pt-4 mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Zwischensumme</span>
              <span className="tabular-nums">CHF {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Percent className="w-3 h-3" /> Trinkgeld
              </span>
              <div className="flex gap-1">
                {[0, 5, 10, 15].map((p) => {
                  const v = +((subtotal * p) / 100).toFixed(2);
                  return (
                    <button
                      key={p}
                      onClick={() => setTip(v)}
                      className={`px-2 py-1 rounded-md text-xs ${
                        tip === v ? "bg-accent text-accent-foreground" : "bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      {p}%
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-muted-foreground">Gesamt</span>
              <span className="text-2xl font-semibold tabular-nums text-gradient-gold">
                CHF {total.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3">
              {[
                { mode: "card" as const, icon: CreditCard, label: "Karte" },
                { mode: "cash" as const, icon: Banknote, label: "Bar" },
              ].map((m) => (
                <button
                  key={m.label}
                  onClick={() => setPayMode(m.mode)}
                  disabled={(isTab ? tabItems.length === 0 : walkInCart.length === 0) || payTab.isPending}
                  className="glass rounded-xl py-3 flex flex-col items-center gap-1 text-xs hover:border-accent/40 transition-colors disabled:opacity-40"
                >
                  <m.icon className="w-4 h-4" />
                  {m.label}
                </button>
              ))}
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={(isTab ? tabItems.length === 0 : walkInCart.length === 0) || payTab.isPending}
              onClick={printInterim}
              className="w-full rounded-2xl py-3 mt-2 bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-semibold shadow-[var(--shadow-gold)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Zwischenrechnung • CHF {total.toFixed(2)}
            </motion.button>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {payMode && (
          <PaymentDialog
            mode={payMode}
            total={total}
            printers={printers}
            tableName={isTab ? activeOrder?.dining_tables?.name ?? "Tisch" : "Theke"}
            onClose={() => setPayMode(null)}
            onConfirm={(method, _received, _diff, _diffType) => {
              setPayMode(null);
              if (isTab) {
                payTab.mutate({ method });
              } else if (walkInCart.length > 0) {
                payWalkIn.mutate({ method });
              }
            }}
          />
        )}
      </AnimatePresence>

      <ProductModifierDialog
        product={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onConfirm={(c) => {
          if (!editing) return;
          if (isTab) addToTab.mutate({ p: editing, c });
          else addWalkIn(editing, c);
        }}
      />
    </div>
  );
}

const CARD_METHODS = ["Visa", "Mastercard", "Maestro", "Amex", "TWINT", "Postcard", "Lunch-Check"] as const;

function PaymentDialog({
  mode,
  total,
  printers,
  tableName,
  onClose,
  onConfirm,
}: {
  mode: "cash" | "card";
  total: number;
  printers: PrinterConfig[];
  tableName: string;
  onClose: () => void;
  onConfirm: (method: string, received: number, diff: number, diffType: "tip" | "change") => void;
}) {
  const [cardMethod, setCardMethod] = useState<string>(CARD_METHODS[0]);
  const [receivedStr, setReceivedStr] = useState<string>(total.toFixed(2));
  const [diffType, setDiffType] = useState<"tip" | "change">(mode === "card" ? "tip" : "change");
  const [sumupPhase, setSumupPhase] = useState<"idle" | "sending" | "waiting" | "ok" | "fail">("idle");
  const [sumupMsg, setSumupMsg] = useState<string>("");
  const sendToReader = useServerFn(sumupSendToReader);
  const getTxStatus = useServerFn(sumupGetTransactionStatus);
  const listReaders = useServerFn(sumupListReaders);

  const diagnose = async () => {
    setSumupMsg("Lade Reader …");
    try {
      const r = await listReaders({ data: undefined as any });
      if (!r.readers.length) {
        setSumupMsg(
          `Merchant ${r.merchantCode}: keine Reader über API gefunden. ` +
            `Der Reader muss im selben SumUp-Konto hängen wie der API-Key; die Seriennummer ist nicht die rdr_… Reader-ID.`,
        );
      } else {
        const list = r.readers.map((x) => `${x.name ?? "?"} → ${x.id} [${x.status ?? "?"}]`).join("  |  ");
        setSumupMsg(`Verfügbare Reader: ${list}`);
      }
    } catch (e: any) {
      setSumupMsg(e?.message ?? "Diagnose fehlgeschlagen");
    }
  };

  const runSumUp = async () => {
    setSumupPhase("sending");
    setSumupMsg("Sende an Terminal …");
    try {
      const { clientTransactionId } = await sendToReader({
        data: { amount: total, description: "Kasse" },
      });
      if (!clientTransactionId) {
        // Kein Polling möglich — Mitarbeiter muss am Gerät bestätigen
        setSumupPhase("waiting");
        setSumupMsg("Am Terminal bezahlen …");
        return;
      }
      setSumupPhase("waiting");
      setSumupMsg("Am Terminal bezahlen …");
      const started = Date.now();
      while (Date.now() - started < 120_000) {
        await new Promise((r) => setTimeout(r, 2500));
        try {
          const s = await getTxStatus({ data: { clientTransactionId } });
          if (s.status === "SUCCESSFUL") {
            setSumupPhase("ok");
            setSumupMsg("Bezahlung erfolgreich");
            if (isDesktopApp()) {
              const err = await printCardReceipt({
                printers,
                info: {
                  transactionId: s.transactionId,
                  transactionCode: s.transactionCode,
                  cardType: s.cardType,
                  cardLast4: s.cardLast4,
                  authCode: s.authCode,
                  entryMode: s.entryMode,
                  amount: total,
                  currency: s.currency,
                  timestamp: s.timestamp,
                  merchantCode: s.merchantCode,
                  tableName,
                },
              });
              if (err) toast.error(`Karten-Beleg: ${err}`);
            }
            setTimeout(() => onConfirm("SumUp Terminal", total, 0, "tip"), 500);
            return;
          }
          if (s.status === "FAILED" || s.status === "CANCELLED") {
            setSumupPhase("fail");
            setSumupMsg(s.status === "CANCELLED" ? "Am Terminal abgebrochen" : "Zahlung fehlgeschlagen");
            return;
          }
        } catch {
          // weiter pollen
        }
      }
      setSumupPhase("fail");
      setSumupMsg("Zeitüberschreitung. Bitte am Terminal prüfen.");
    } catch (e: any) {
      setSumupPhase("fail");
      setSumupMsg(e?.message ?? "Fehler beim Senden");
    }
  };

  const received = Number(receivedStr.replace(",", ".")) || 0;
  const diff = +(received - total).toFixed(2);
  const valid = received >= total;
  const method = mode === "cash" ? "Bar" : cardMethod;

  const quick = mode === "cash"
    ? Array.from(
        new Set(
          [total, Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20, Math.ceil(total / 50) * 50].filter(
            (v) => v >= total,
          ),
        ),
      ).slice(0, 5)
    : [total, total + 1, total + 2, total + 5, total + 10];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-3xl p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {mode === "cash" ? "Bar" : "Karte"}
            </div>
            <h2 className="text-xl font-semibold">Zahlung erfassen</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {mode === "card" && (
          <div className="space-y-1.5 mb-4">


            <button
              onClick={runSumUp}
              disabled={sumupPhase === "sending" || sumupPhase === "waiting"}
              className="mt-3 w-full rounded-xl py-3 bg-accent/15 hover:bg-accent/25 border border-accent/40 text-accent font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {sumupPhase === "sending" || sumupPhase === "waiting" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Smartphone className="w-4 h-4" />
              )}
              {sumupPhase === "idle" && `An SumUp-Terminal senden · CHF ${total.toFixed(2)}`}
              {sumupPhase === "sending" && "Sende …"}
              {sumupPhase === "waiting" && "Warte auf Terminal …"}
              {sumupPhase === "ok" && "Bezahlt ✓"}
              {sumupPhase === "fail" && "Erneut senden"}
            </button>
            {sumupMsg && (
              <div
                className={`text-xs mt-1.5 text-center ${
                  sumupPhase === "fail"
                    ? "text-destructive"
                    : sumupPhase === "ok"
                      ? "text-success"
                      : "text-muted-foreground"
                }`}
              >
                {sumupMsg}
              </div>
            )}
            <button
              type="button"
              onClick={diagnose}
              className="mt-1 w-full text-[11px] text-muted-foreground hover:text-accent underline"
            >
              Reader-ID suchen
            </button>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Gesamt</span>
            <span className="text-xl font-semibold tabular-nums">CHF {total.toFixed(2)}</span>
          </div>

          {mode === "cash" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Erhalten (CHF)</label>
                <input
                  type="number"
                  step="0.05"
                  min={0}
                  value={receivedStr}
                  onChange={(e) => setReceivedStr(e.target.value)}
                  className="glass rounded-xl px-3 py-3 text-lg w-full outline-none bg-transparent tabular-nums font-semibold"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  {quick.map((v) => (
                    <button
                      key={v}
                      onClick={() => setReceivedStr(v.toFixed(2))}
                      className="rounded-lg px-2.5 py-1.5 text-xs glass hover:border-accent/40 tabular-nums"
                    >
                      CHF {v.toFixed(2)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Differenz</span>
                  <span className={`text-lg font-semibold tabular-nums ${diff < 0 ? "text-destructive" : ""}`}>
                    CHF {diff.toFixed(2)}
                  </span>
                </div>
                {diff > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDiffType("tip")}
                      className={`flex-1 rounded-lg py-2 text-xs border-2 transition-all ${
                        diffType === "tip" ? "border-success bg-success/10 text-success" : "border-transparent glass text-muted-foreground"
                      }`}
                    >
                      Trinkgeld
                    </button>
                    <button
                      onClick={() => setDiffType("change")}
                      className={`flex-1 rounded-lg py-2 text-xs border-2 transition-all ${
                        diffType === "change" ? "border-accent bg-accent/10 text-foreground" : "border-transparent glass text-muted-foreground"
                      }`}
                    >
                      Rückgeld
                    </button>
                  </div>
                )}
                {diff === 0 && <div className="text-xs text-muted-foreground">Passend bezahlt</div>}
                {diff < 0 && <div className="text-xs text-destructive">Betrag zu niedrig</div>}
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                disabled={!valid}
                onClick={() => onConfirm(method, received, diff, diffType)}
                className="w-full rounded-2xl py-3.5 bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-semibold shadow-[var(--shadow-gold)] disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Bestätigen
              </motion.button>
            </>
          )}
        </div>

      </motion.div>
    </motion.div>
  );
}
