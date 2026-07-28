import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Bike,
  CreditCard,
  Loader2,
  Minus,
  Phone,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { DELIVERY_MENU, type DeliveryMenuItem } from "@/lib/delivery-menu";
import { printBill, type ReceiptItem } from "@/lib/receipt";
import { isAutoPrintEnabled, isDesktopApp } from "@/lib/printer-bridge";

export const Route = createFileRoute("/lieferung")({
  head: () => ({
    meta: [
      { title: "Lieferung — Piratino POS" },
      { name: "description", content: "Lieferbestellungen mit Kundenadresse und Lieferkarte erfassen." },
      { property: "og:title", content: "Lieferung — Piratino POS" },
      { property: "og:description", content: "Lieferbestellungen mit Kundenadresse und Lieferkarte erfassen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Lieferung,
});

type Step = "customer" | "order" | "checkout";

interface Customer {
  id: string;
  last_name: string;
  first_name: string;
  street: string;
  house_no: string;
  zip: string;
  city: string;
  phone: string;
  phone2: string | null;
  note: string | null;
}

interface CartLine {
  key: string;
  item: DeliveryMenuItem;
  category: string;
  qty: number;
  note?: string;
}

interface DeliveryReceipt {
  orderId: string;
  customerName: string;
  address: string;
  phone: string;
  note: string;
  customerNote: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  createdAt: string;
  paid?: boolean;
  payMethod?: "open" | "cash" | "card";
}

function customerName(c: Customer) {
  return [c.last_name, c.first_name].filter(Boolean).join(" ").trim() || "Ohne Namen";
}
function customerAddress(c: Customer) {
  return `${c.street} ${c.house_no}, ${c.zip} ${c.city}`.replace(/\s+/g, " ").trim();
}

const EMPTY_FORM = {
  last_name: "",
  first_name: "",
  street: "",
  house_no: "",
  zip: "",
  city: "",
  phone: "",
  note: "",
};

const STEPS: { key: Step; label: string }[] = [
  { key: "customer", label: "Kundenadresse" },
  { key: "order", label: "Bestellung" },
  { key: "checkout", label: "Lieferbestellung" },
];

function Lieferung() {
  const qc = useQueryClient();
  const { operator } = useAuth();

  const [step, setStep] = useState<Step>("customer");
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const [activeCategory, setActiveCategory] = useState(DELIVERY_MENU[0]?.category ?? "");
  const [productSearch, setProductSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [receipt, setReceipt] = useState<DeliveryReceipt | null>(null);

  const { data: customers = [], isFetching: searching } = useQuery({
    queryKey: ["customers", search],
    enabled: search.trim().length >= 2,
    queryFn: async (): Promise<Customer[]> => {
      const like = `%${search.trim()}%`;
      const { data, error } = await supabase
        .from("customers")
        .select("id, last_name, first_name, street, house_no, zip, city, phone, phone2, note")
        .or(
          `last_name.ilike.${like},first_name.ilike.${like},street.ilike.${like},phone.ilike.${like},city.ilike.${like},zip.ilike.${like}`,
        )
        .order("last_name")
        .limit(40);
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });

  const { data: openDeliveries = [] } = useQuery({
    queryKey: ["orders", "delivery", "open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, opened_at, delivery_address, delivery_note, courier_started_at")
        .eq("order_type", "delivery")
        .eq("status", "open")
        .is("courier_started_at", null)
        .order("opened_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  // Tageshistorie: alle Lieferungen von heute
  const { data: todayDeliveries = [] } = useQuery({
    queryKey: ["orders", "delivery", "today"],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, status, opened_at, delivery_address, delivery_note, customer_id, courier_started_at")
        .eq("order_type", "delivery")
        .gte("opened_at", start.toISOString())
        .order("opened_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 15000,
  });

  // Kundenhistorie: letzte Lieferungen des gewählten Kunden
  const { data: customerHistory = [] } = useQuery({
    queryKey: ["orders", "delivery", "customer", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, status, opened_at, delivery_note")
        .eq("order_type", "delivery")
        .eq("customer_id", customer!.id)
        .order("opened_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const createCustomer = useMutation({
    mutationFn: async () => {
      if (!form.street.trim() || !form.zip.trim() || !form.city.trim())
        throw new Error("Strasse, PLZ und Ort sind Pflicht");
      const { data, error } = await supabase
        .from("customers")
        .insert({
          last_name: form.last_name.trim(),
          first_name: form.first_name.trim(),
          street: form.street.trim(),
          house_no: form.house_no.trim(),
          zip: form.zip.trim(),
          city: form.city.trim(),
          phone: form.phone.trim(),
          note: form.note.trim() || null,
        })
        .select("id, last_name, first_name, street, house_no, zip, city, phone, phone2, note")
        .single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: (c) => {
      setCustomer(c);
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Kunde gespeichert");
      setStep("order");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const menuItems = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (term) {
      return DELIVERY_MENU.flatMap((c) => c.items.map((i) => ({ ...i, category: c.category }))).filter((i) =>
        i.name.toLowerCase().includes(term),
      );
    }
    const cat = DELIVERY_MENU.find((c) => c.category === activeCategory);
    return (cat?.items ?? []).map((i) => ({ ...i, category: cat!.category }));
  }, [activeCategory, productSearch]);

  const addItem = (item: DeliveryMenuItem & { category: string }) =>
    setCart((prev) => {
      const found = prev.find((l) => l.item.id === item.id && !l.note);
      if (found) return prev.map((l) => (l.key === found.key ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { key: `${item.id}-${Date.now()}`, item, category: item.category, qty: 1 }];
    });

  const changeQty = (key: string, delta: number) =>
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0));

  const subtotal = cart.reduce((s, l) => s + l.item.price * l.qty, 0);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  const resetAll = () => {
    setCart([]);
    setDeliveryNote("");
    setCustomer(null);
    setSearch("");
    setProductSearch("");
    setStep("customer");
  };

  const saveOrder = useMutation({
    mutationFn: async ({ pay }: { pay: "open" | "cash" | "card" }) => {
      if (!customer) throw new Error("Bitte zuerst eine Kundenadresse erfassen");
      if (cart.length === 0) throw new Error("Keine Produkte gewählt");

      const address = customerAddress(customer);
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          status: "open",
          order_type: "delivery",
          customer_id: customer.id,
          delivery_address: `${customerName(customer)} · ${address}${customer.phone ? ` · ${customer.phone}` : ""}`,
          delivery_note: deliveryNote.trim() || null,
          total: 0,
          opened_by_name: operator?.name ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: itemErr } = await supabase.from("order_items").insert(
        cart.map((l) => ({
          order_id: order.id,
          product_id: l.item.id,
          product_name: l.item.name,
          category: l.category,
          unit_price: l.item.price,
          qty: l.qty,
          modifiers: [],
          note: l.note ?? null,
        })),
      );
      if (itemErr) throw itemErr;

      if (pay !== "open") {
        const { error: payErr } = await supabase.from("payment_requests").insert({
          order_id: order.id,
          table_name: `Lieferung · ${customerName(customer)}`,
          amount: subtotal,
          tip: 0,
          method: pay === "cash" ? "cash" : "card_terminal",
          status: "paid",
          handled_at: new Date().toISOString(),
          note: `Lieferung · ${address}`,
        });
        if (payErr) throw payErr;
        const { error: upErr } = await supabase
          .from("orders")
          .update({ status: "paid", closed_at: new Date().toISOString(), total: subtotal })
          .eq("id", order.id);
        if (upErr) throw upErr;
      }

      try {
        if (isDesktopApp() && isAutoPrintEnabled()) {
          const { data: printers } = await supabase
            .from("printers")
            .select("id, name, type, ip_address, port")
            .eq("active", true);
          const items: ReceiptItem[] = cart.map((l) => ({
            product_name: l.item.name,
            qty: l.qty,
            unit_price: l.item.price,
            modifiers: [],
          }));
          await printBill({
            printers: (printers ?? []) as any,
            tableName: `LIEFERUNG · ${customerName(customer)} · ${address}${
              customer.phone ? ` · ${customer.phone}` : ""
            }${deliveryNote.trim() ? ` · ${deliveryNote.trim()}` : ""}`,
            items,
            total: subtotal,
            paymentMethod: pay === "cash" ? "Bar" : pay === "card" ? "Karte" : null,
            interim: pay === "open",
            title: "LIEFERSCHEIN",
            footerNote:
              pay === "open" ? "Offen — beim Kunden kassieren" : "Bezahlt — vielen Dank!",
            qrUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/kurier/${order.id}`,
            qrLabel: "QR scannen: Adresse, Navigation & Anruf",
          });
        }
      } catch (err) {
        // Druckfehler darf die Bestellung nicht abbrechen
        toast.error(
          err instanceof Error ? `Druckfehler: ${err.message}` : "Druckfehler",
        );
      }

      return {
        pay,
        receipt: {
          orderId: order.id as string,
          customerName: customerName(customer),
          address,
          phone: customer.phone,
          note: deliveryNote.trim(),
          customerNote: customer.note ?? "",
          items: cart.map((l) => ({ name: l.item.name, qty: l.qty, price: l.item.price })),
          total: subtotal,
          createdAt: new Date().toISOString(),
        } as DeliveryReceipt,
      };
    },
    onSuccess: ({ pay, receipt }) => {
      toast.success(pay === "open" ? "Lieferbestellung erfasst" : "Lieferung bezahlt");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order_items"] });
      setReceipt({ ...receipt, paid: pay !== "open", payMethod: pay });
      resetAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="h-screen flex flex-col p-4 lg:p-6 pb-28 md:pb-6 max-w-[1800px] mx-auto w-full">
      {/* Kopf mit Schritten */}
      <header className="flex items-center gap-3 mb-4 shrink-0">
        {step !== "customer" && (
          <button
            onClick={() => setStep(step === "checkout" ? "order" : "customer")}
            className="w-11 h-11 rounded-xl glass flex items-center justify-center active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Lieferung</div>
          <h1 className="text-xl font-semibold truncate">
            {stepIndex + 1}. {STEPS[stepIndex].label}
            {customer && step !== "customer" && (
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                · {customerName(customer)}, {customerAddress(customer)}
              </span>
            )}
          </h1>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`h-1.5 rounded-full transition-all ${
                i <= stepIndex ? "bg-accent w-10" : "bg-white/10 w-6"
              }`}
            />
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {/* ── SCHRITT 1: KUNDENADRESSE ─────────────── */}
        {step === "customer" && (
          <motion.div
            key="customer"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 min-h-0 overflow-y-auto"
          >
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="glass-strong rounded-3xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Bike className="w-4 h-4 text-accent" /> Kunde suchen
                  </h2>
                  <button
                    onClick={() => setShowForm((v) => !v)}
                    className="text-xs glass rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:border-accent/40"
                  >
                    <UserPlus className="w-3 h-3" /> Neuer Kunde
                  </button>
                </div>

                <div className="glass rounded-xl flex items-center gap-2 px-3 py-3">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name, Telefon, Strasse oder Ort suchen…"
                    className="bg-transparent outline-none text-base flex-1 placeholder:text-muted-foreground"
                  />
                  {searching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>

                {search.trim().length >= 2 && (
                  <div className="mt-3 space-y-1.5 max-h-[45vh] overflow-y-auto">
                    {customers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCustomer(c);
                          setSearch("");
                          setStep("order");
                        }}
                        className="w-full text-left glass rounded-xl px-4 py-3 hover:border-accent/40 transition-colors"
                      >
                        <div className="text-sm font-medium">{customerName(c)}</div>
                        <div className="text-xs text-muted-foreground">
                          {customerAddress(c)}
                          {c.phone ? ` · ${c.phone}` : ""}
                        </div>
                      </button>
                    ))}
                    {customers.length === 0 && !searching && (
                      <div className="text-sm text-muted-foreground px-1 py-3">Keine Kunden gefunden</div>
                    )}
                  </div>
                )}

                <AnimatePresence>
                  {showForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {(
                          [
                            ["last_name", "Name"],
                            ["first_name", "Vorname"],
                            ["street", "Strasse"],
                            ["house_no", "Nr."],
                            ["zip", "PLZ"],
                            ["city", "Ort"],
                            ["phone", "Telefon"],
                            ["note", "Notiz"],
                          ] as const
                        ).map(([key, label]) => (
                          <div key={key} className="space-y-1">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {label}
                            </label>
                            <input
                              value={(form as any)[key]}
                              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                              className="glass rounded-xl px-3 py-2.5 w-full text-sm outline-none bg-transparent"
                            />
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => createCustomer.mutate()}
                        disabled={createCustomer.isPending}
                        className="mt-3 w-full rounded-xl py-3 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40"
                      >
                        {createCustomer.isPending ? "Speichern…" : "Kunde speichern & weiter"}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {customer && (
                <button
                  onClick={() => setStep("order")}
                  className="w-full glass-strong rounded-2xl p-4 flex items-center justify-between hover:border-accent/40"
                >
                  <div className="text-left text-sm">
                    <div className="font-medium">{customerName(customer)}</div>
                    <div className="text-muted-foreground">{customerAddress(customer)}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-accent" />
                </button>
              )}

              {openDeliveries.length > 0 && (
                <section className="glass-strong rounded-3xl p-5">
                  <h2 className="font-semibold mb-3">Offene Lieferungen</h2>
                  <div className="space-y-2">
                    {openDeliveries.map((o: any) => (
                      <div key={o.id} className="glass rounded-xl px-3 py-2 flex items-center justify-between gap-3">
                        <div className="text-sm min-w-0">
                          <div className="truncate">{o.delivery_address ?? "Lieferung"}</div>
                          {o.delivery_note && (
                            <div className="text-xs text-muted-foreground truncate">{o.delivery_note}</div>
                          )}
                        </div>
                        <div className="text-sm font-semibold tabular-nums shrink-0">
                          CHF {Number(o.total).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {customer && customerHistory.length > 0 && (
                <section className="glass-strong rounded-3xl p-5">
                  <h2 className="font-semibold mb-3">Kundenhistorie — {customerName(customer)}</h2>
                  <div className="space-y-2">
                    {customerHistory.map((o) => (
                      <div key={o.id} className="glass rounded-xl px-3 py-2 flex items-center justify-between gap-3">
                        <div className="text-sm min-w-0">
                          <div>
                            {new Date(o.opened_at).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                            {" · "}
                            {new Date(o.opened_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          {o.delivery_note && (
                            <div className="text-xs text-muted-foreground truncate">{o.delivery_note}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-[10px] uppercase tracking-wider ${o.status === "paid" ? "text-emerald-400" : "text-amber-400"}`}>
                            {o.status === "paid" ? "Bezahlt" : o.status === "cancelled" ? "Storniert" : "Offen"}
                          </span>
                          <span className="text-sm font-semibold tabular-nums">CHF {Number(o.total).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="glass-strong rounded-3xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Tageshistorie</h2>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {todayDeliveries.length} Lieferungen · CHF{" "}
                    {todayDeliveries.reduce((s2, o) => s2 + Number(o.total || 0), 0).toFixed(2)}
                  </div>
                </div>
                {todayDeliveries.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Heute noch keine Lieferungen.</div>
                ) : (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                    {todayDeliveries.map((o) => (
                      <div key={o.id} className="glass rounded-xl px-3 py-2 flex items-center justify-between gap-3">
                        <div className="text-sm min-w-0">
                          <div className="truncate">{o.delivery_address ?? "Lieferung"}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(o.opened_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                            {o.courier_started_at ? " · unterwegs" : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-[10px] uppercase tracking-wider ${o.status === "paid" ? "text-emerald-400" : "text-amber-400"}`}>
                            {o.status === "paid" ? "Bezahlt" : o.status === "cancelled" ? "Storniert" : "Offen"}
                          </span>
                          <span className="text-sm font-semibold tabular-nums">CHF {Number(o.total).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </motion.div>
        )}

        {/* ── SCHRITT 2: BESTELLUNG (gross) ────────── */}
        {step === "order" && (
          <motion.div
            key="order"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 min-h-0 flex flex-col"
          >
            <div className="glass rounded-xl flex items-center gap-2 px-3 py-3 mb-3 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Produkt suchen…"
                className="bg-transparent outline-none text-base flex-1 placeholder:text-muted-foreground"
              />
            </div>

            {!productSearch && (
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 shrink-0">
                {DELIVERY_MENU.map((c) => (
                  <button
                    key={c.category}
                    onClick={() => setActiveCategory(c.category)}
                    className={`shrink-0 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      activeCategory === c.category
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "glass text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.category}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto mt-3 pb-28">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {menuItems.map((item) => {
                  const inCart = cart.filter((l) => l.item.id === item.id).reduce((s, l) => s + l.qty, 0);
                  return (
                    <motion.button
                      key={item.id}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => addItem(item)}
                      className="glass rounded-2xl p-4 text-left min-h-28 flex flex-col justify-between hover:border-accent/40 transition-colors relative"
                    >
                      {inCart > 0 && (
                        <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-accent text-accent-foreground text-xs font-semibold flex items-center justify-center tabular-nums">
                          {inCart}
                        </span>
                      )}
                      <div>
                        <div className="text-sm font-medium leading-tight pr-6">{item.name}</div>
                        {item.description && (
                          <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                            {item.description}
                          </div>
                        )}
                      </div>
                      <div className="text-base font-semibold tabular-nums mt-2">CHF {item.price.toFixed(2)}</div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Sticky Warenkorb-Leiste */}
            <AnimatePresence>
              {cart.length > 0 && (
                <motion.div
                  initial={{ y: 100 }}
                  animate={{ y: 0 }}
                  exit={{ y: 100 }}
                  transition={{ type: "spring", damping: 25, stiffness: 250 }}
                  className="fixed bottom-20 md:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-[520px] z-40"
                >
                  <button
                    onClick={() => setStep("checkout")}
                    className="w-full rounded-2xl py-4 px-5 bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-semibold shadow-[var(--shadow-gold)] flex items-center justify-between"
                  >
                    <span className="text-sm">
                      {itemCount} Artikel · CHF {subtotal.toFixed(2)}
                    </span>
                    <span className="flex items-center gap-2">
                      Weiter <ArrowRight className="w-4 h-4" />
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── SCHRITT 3: LIEFERBESTELLUNG ──────────── */}
        {step === "checkout" && (
          <motion.div
            key="checkout"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 min-h-0 overflow-y-auto"
          >
            <div className="max-w-3xl mx-auto space-y-4">
              {customer && (
                <div className="glass-strong rounded-3xl p-5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Lieferadresse</div>
                  <div className="text-sm font-medium">{customerName(customer)}</div>
                  <div className="text-sm text-muted-foreground">{customerAddress(customer)}</div>
                  {customer.phone && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {customer.phone}
                    </div>
                  )}
                </div>
              )}

              <div className="glass-strong rounded-3xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Lieferbestellung</h2>
                  <button
                    onClick={() => setCart([])}
                    className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Leeren
                  </button>
                </div>

                <div className="space-y-2">
                  {cart.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">Keine Produkte gewählt</div>
                  )}
                  {cart.map((l) => (
                    <div key={l.key} className="flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.03]">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{l.item.name}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          CHF {l.item.price.toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 glass rounded-lg p-0.5 shrink-0">
                        <button
                          onClick={() => changeQty(l.key, -1)}
                          className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-white/10"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-sm tabular-nums">{l.qty}</span>
                        <button
                          onClick={() => changeQty(l.key, 1)}
                          className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-white/10"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-sm font-semibold tabular-nums w-16 text-right shrink-0">
                        {(l.item.price * l.qty).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setStep("order")}
                  className="mt-3 w-full glass rounded-xl py-2.5 text-sm hover:border-accent/40"
                >
                  + Weitere Produkte
                </button>
              </div>

              <div className="glass-strong rounded-3xl p-5 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Liefernotiz</label>
                  <input
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                    placeholder="z.B. 3. Stock, klingeln bei Meier"
                    className="glass rounded-xl px-3 py-3 w-full text-sm outline-none bg-transparent"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Gesamt</span>
                  <span className="text-3xl font-semibold tabular-nums text-gradient-gold">
                    CHF {subtotal.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={() => saveOrder.mutate({ pay: "open" })}
                  disabled={!customer || cart.length === 0 || saveOrder.isPending}
                  className="w-full rounded-2xl py-4 glass text-sm font-medium hover:border-accent/40 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {saveOrder.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bike className="w-4 h-4" />}
                  Bestellung senden (offen)
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => saveOrder.mutate({ pay: "cash" })}
                    disabled={!customer || cart.length === 0 || saveOrder.isPending}
                    className="rounded-xl py-4 glass flex flex-col items-center gap-1 text-xs hover:border-accent/40 disabled:opacity-40"
                  >
                    <Banknote className="w-4 h-4" /> Bar bezahlt
                  </button>
                  <button
                    onClick={() => saveOrder.mutate({ pay: "card" })}
                    disabled={!customer || cart.length === 0 || saveOrder.isPending}
                    className="rounded-xl py-4 glass flex flex-col items-center gap-1 text-xs hover:border-accent/40 disabled:opacity-40"
                  >
                    <CreditCard className="w-4 h-4" /> Karte bezahlt
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {receipt && <DeliveryReceiptOverlay receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function DeliveryReceiptOverlay({ receipt, onClose }: { receipt: DeliveryReceipt; onClose: () => void }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const courierUrl = `${origin}/kurier/${receipt.orderId}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=6&data=${encodeURIComponent(
    courierUrl,
  )}`;

  // Ohne Print-Agent (kein Direktdruck möglich): Browser-Druckdialog öffnen.
  useEffect(() => {
    if (isDesktopApp()) return;
    if (!isAutoPrintEnabled()) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);



  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 print:bg-white print:p-0">
      <div className="w-full max-w-sm max-h-[92vh] overflow-y-auto rounded-3xl glass-strong p-6 print:max-h-none print:rounded-none print:bg-white print:text-black">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground print:text-black">
            Piratino Lieferung
          </div>
          <h2 className="text-xl font-semibold mt-1">Lieferschein</h2>
          <div className="text-xs text-muted-foreground print:text-black">
            #{receipt.orderId.slice(0, 8).toUpperCase()} ·{" "}
            {new Date(receipt.createdAt).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" })}
          </div>
        </div>

        <div className="mt-4 text-sm space-y-0.5">
          <div className="font-semibold">{receipt.customerName}</div>
          <div>{receipt.address}</div>
          {receipt.phone && <div className="text-muted-foreground print:text-black">Tel. {receipt.phone}</div>}
          {receipt.customerNote && (
            <div className="text-muted-foreground print:text-black">Kunde: {receipt.customerNote}</div>
          )}
          {receipt.note && <div className="text-accent print:text-black">Notiz: {receipt.note}</div>}
        </div>

        <div className="mt-4 border-t border-white/10 pt-3 space-y-1.5 text-sm">
          {receipt.items.map((i, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="w-7 tabular-nums">{i.qty}×</span>
              <span className="flex-1 min-w-0">{i.name}</span>
              <span className="tabular-nums">{(i.qty * i.price).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t border-white/10 pt-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground print:text-black">Total</span>
          <span className="text-2xl font-semibold tabular-nums">CHF {receipt.total.toFixed(2)}</span>
        </div>
        <div className="text-xs text-center mt-1 text-muted-foreground print:text-black">
          {receipt.paid
            ? `Bezahlt (${receipt.payMethod === "cash" ? "Bar" : "Karte"})`
            : "Offen — beim Kunden kassieren"}
        </div>

        <div className="mt-5 flex flex-col items-center">
          <img
            src={qrSrc}
            alt={`QR-Code zum Lieferauftrag ${receipt.orderId.slice(0, 8)}`}
            className="w-40 h-40 rounded-xl bg-white p-2"
          />
          <div className="text-[11px] text-center text-muted-foreground mt-2 print:text-black">
            QR scannen für Adresse, Navigation & Anruf
          </div>
          <div className="text-[10px] text-center text-muted-foreground break-all print:text-black">{courierUrl}</div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-5 print:hidden">
          <button onClick={() => window.print()} className="rounded-xl py-3 glass text-sm">
            Drucken
          </button>
          <button onClick={onClose} className="rounded-xl py-3 bg-accent/20 text-accent text-sm font-medium">
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
