import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Bike,
  CreditCard,
  Loader2,
  MapPin as MapPinIcon,
  Minus,
  Phone,
  Plus,
  Search,
  ShoppingBag,

  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { DeliveryMap, type MapPin as MapPinData } from "@/components/DeliveryMap";
import { geocodeCustomers } from "@/lib/geo.functions";
import { DELIVERY_MENU, type DeliveryMenuItem } from "@/lib/delivery-menu";
import { takeawayPrice } from "@/lib/takeaway-pricing";
import { printBill, type ReceiptItem } from "@/lib/receipt";
import { isAutoPrintEnabled, isDesktopApp } from "@/lib/printer-bridge";
import { sendOrderReceivedSms } from "@/lib/order-sms.functions";



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

const TAKEAWAY_STEPS: { key: Step; label: string }[] = [
  { key: "customer", label: "Telefonnummer" },
  { key: "order", label: "Bestellung" },
  { key: "checkout", label: "Takeaway-Bestellung" },
];

/** Grobe Abholzeit-Schätzung in Minuten (Basis 20 Min., +5 pro 4 Artikel, max. 45). */
function estimateMinutes(itemCount: number) {
  return Math.min(45, 20 + Math.floor(Math.max(0, itemCount - 1) / 4) * 5);
}

function Lieferung() {
  const qc = useQueryClient();
  const { operator } = useAuth();

  const [mode, setMode] = useState<"delivery" | "takeaway">("delivery");
  const [taName, setTaName] = useState("");
  const [taPhone, setTaPhone] = useState("");

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

  const { data: couriers = [] } = useQuery({
    queryKey: ["team_members", "couriers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, role")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const assignCourier = useMutation({
    mutationFn: async ({ orderId, courierId }: { orderId: string; courierId: string | null }) => {
      const c = couriers.find((x: any) => x.id === courierId) as any;
      const { error } = await (supabase.from("orders") as any)
        .update({
          courier_id: courierId,
          courier_name: c?.name ?? null,
          courier_assigned_at: courierId ? new Date().toISOString() : null,
        })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", "delivery"] });
      toast.success("Kurier zugewiesen");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const { data: openDeliveries = [] } = useQuery({
    queryKey: ["orders", "delivery", "open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, opened_at, delivery_address, delivery_note, courier_started_at, courier_id, courier_name")
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
        .select("id, total, status, opened_at, delivery_address, delivery_note, customer_id, courier_started_at, courier_name")
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

  const [configItem, setConfigItem] = useState<(DeliveryMenuItem & { category: string }) | null>(null);

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

  const addItem = (item: DeliveryMenuItem & { category: string }, note?: string) =>
    setCart((prev) => {
      const found = prev.find((l) => l.item.id === item.id && (l.note ?? "") === (note ?? ""));
      if (found) return prev.map((l) => (l.key === found.key ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { key: `${item.id}-${Date.now()}`, item, category: item.category, qty: 1, note }];
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

      // Zahlung erfolgt erst beim Kunden durch den Kurier — Bestellung bleibt offen.
      if (subtotal > 0) {
        await supabase.from("orders").update({ total: subtotal }).eq("id", order.id);
      }

      // Bestätigungs-SMS an den Kunden (darf die Bestellung nicht blockieren)
      void sendOrderReceivedSms({ data: { orderId: order.id as string } }).catch(() => undefined);




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
            paymentMethod: pay === "cash" ? "Bar (beim Kunden)" : pay === "card" ? "Karte (beim Kunden)" : null,
            interim: true,
            title: "LIEFERSCHEIN",
            footerNote:
              pay === "cash"
                ? "Offen — bar beim Kunden kassieren"
                : pay === "card"
                  ? "Offen — mit Karte beim Kunden kassieren"
                  : "Offen — beim Kunden kassieren",

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
      toast.success("Lieferbestellung erfasst — Zahlung beim Kunden");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order_items"] });
      setReceipt({ ...receipt, paid: false, payMethod: pay });
      setShowWizard(false);
      resetAll();
    },

    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  // ── Karten-Daten ────────────────────────────────
  const [showWizard, setShowWizard] = useState(false);

  const { data: mapOrders = [] } = useQuery({
    queryKey: ["orders", "delivery", "map"],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, total, status, opened_at, delivery_address, delivery_note, courier_id, courier_name, courier_started_at, courier_delivered_at, customer_id, customers:customer_id(id, first_name, last_name, street, house_no, zip, city, phone, lat, lng)",
        )
        .eq("order_type", "delivery")
        .gte("opened_at", start.toISOString())
        .order("opened_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 10000,
  });

  const { data: courierLocations = [] } = useQuery({
    queryKey: ["courier_locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courier_locations")
        .select("member_id, lat, lng, updated_at, team_members:member_id(name)");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 10000,
  });

  // Fehlende Koordinaten automatisch nachtragen
  const geocode = useServerFn(geocodeCustomers);
  useEffect(() => {
    const missing = Array.from(
      new Set(
        mapOrders
          .filter((o) => o.customers && o.customers.lat == null)
          .map((o) => o.customers.id as string),
      ),
    );
    if (missing.length === 0) return;
    geocode({ data: { ids: missing.slice(0, 40) } })
      .then((r: any) => {
        if (r?.updated) qc.invalidateQueries({ queryKey: ["orders", "delivery", "map"] });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapOrders.length]);

  const isDelivered = (o: any) => !!o.courier_delivered_at;
  const todoOrders = useMemo(
    () => mapOrders.filter((o) => o.status !== "cancelled" && !isDelivered(o) && !o.courier_started_at),
    [mapOrders],
  );
  const enrouteOrders = useMemo(
    () => mapOrders.filter((o) => o.status !== "cancelled" && o.courier_started_at && !isDelivered(o)),
    [mapOrders],
  );
  const doneOrders = useMemo(() => mapOrders.filter(isDelivered), [mapOrders]);

  const pins: MapPinData[] = useMemo(() => {
    const out: MapPinData[] = [];
    const push = (o: any, kind: "todo" | "enroute") => {
      const c = o.customers;
      if (!c || c.lat == null || c.lng == null) return;
      out.push({
        id: o.id,
        lat: Number(c.lat),
        lng: Number(c.lng),
        kind,
        label: `${[c.last_name, c.first_name].filter(Boolean).join(" ")} · CHF ${Number(o.total).toFixed(2)}`,
        sublabel: `${c.street} ${c.house_no}, ${c.zip} ${c.city}${
          o.courier_name ? ` — Kurier: ${o.courier_name}` : ""
        }${kind === "enroute" ? " (unterwegs)" : ""}`,
      });
    };
    todoOrders.forEach((o) => push(o, "todo"));
    enrouteOrders.forEach((o) => push(o, "enroute"));

    courierLocations.forEach((l) => {
      const name = l.team_members?.name ?? "Kurier";
      const load = enrouteOrders.filter((o) => o.courier_id === l.member_id);
      out.push({
        id: `courier-${l.member_id}`,
        lat: Number(l.lat),
        lng: Number(l.lng),
        kind: "courier",
        label: `${name} (${load.length} unterwegs)`,
        sublabel:
          load.map((o: any) => o.delivery_address ?? "Lieferung").join("<br/>") ||
          "Keine aktive Lieferung",
      });
    });
    return out;
  }, [todoOrders, enrouteOrders, courierLocations]);

  // Routen Kurier -> Kunde für laufende Lieferungen
  const mapRoutes = useMemo(() => {
    const out: { id: string; from: { lat: number; lng: number }; to: { lat: number; lng: number } }[] = [];
    enrouteOrders.forEach((o: any) => {
      const c = o.customers;
      const loc = courierLocations.find((l: any) => l.member_id === o.courier_id);
      if (!c || c.lat == null || c.lng == null || !loc) return;
      out.push({
        id: o.id,
        from: { lat: Number(loc.lat), lng: Number(loc.lng) },
        to: { lat: Number(c.lat), lng: Number(c.lng) },
      });
    });
    return out;
  }, [enrouteOrders, courierLocations]);

  const [routeInfo, setRouteInfo] = useState<Record<string, { km: number; minutes: number }>>({});
  const handleRouteInfo = useCallback((id: string, info: { km: number; minutes: number }) => {
    setRouteInfo((prev) =>
      prev[id]?.km === info.km && prev[id]?.minutes === info.minutes ? prev : { ...prev, [id]: info },
    );
  }, []);


  const wizard = (
    <div className="h-full flex flex-col p-4 lg:p-6 pb-28 md:pb-6 max-w-[1800px] mx-auto w-full">

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
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold">Offene Lieferungen</h2>
                    <a href="/kurier" className="text-xs text-accent hover:underline">
                      Kurier-Login
                    </a>
                  </div>

                  <div className="space-y-2">
                    {openDeliveries.map((o: any) => (
                      <div key={o.id} className="glass rounded-xl px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-sm min-w-0 flex-1">
                          <div className="truncate">{o.delivery_address ?? "Lieferung"}</div>
                          {o.delivery_note && (
                            <div className="text-xs text-muted-foreground truncate">{o.delivery_note}</div>
                          )}
                          {o.courier_name && (
                            <div className="text-xs text-accent">Kurier: {o.courier_name}</div>
                          )}
                        </div>
                        <select
                          value={o.courier_id ?? ""}
                          onChange={(e) => assignCourier.mutate({ orderId: o.id, courierId: e.target.value || null })}
                          className="glass rounded-lg px-2 py-1.5 text-xs bg-transparent outline-none shrink-0"
                        >
                          <option value="">Kurier zuweisen…</option>
                          {couriers.map((c: any) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
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
                            {o.courier_name ? ` · ${o.courier_name}` : ""}
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
                      onClick={() => (item.modifierGroups?.length ? setConfigItem(item) : addItem(item))}
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

            {configItem && (
              <MenuConfigDialog
                item={configItem}
                onClose={() => setConfigItem(null)}
                onConfirm={(note) => {
                  addItem(configItem, note);
                  setConfigItem(null);
                }}
              />
            )}
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

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => saveOrder.mutate({ pay: "card" })}
                    disabled={!customer || cart.length === 0 || saveOrder.isPending}
                    className="rounded-2xl py-5 glass flex flex-col items-center gap-1.5 text-sm font-medium hover:border-accent/40 disabled:opacity-40"
                  >
                    {saveOrder.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CreditCard className="w-5 h-5" />
                    )}
                    Zahlt mit Karte
                  </button>
                  <button
                    onClick={() => saveOrder.mutate({ pay: "cash" })}
                    disabled={!customer || cart.length === 0 || saveOrder.isPending}
                    className="rounded-2xl py-5 glass flex flex-col items-center gap-1.5 text-sm font-medium hover:border-accent/40 disabled:opacity-40"
                  >
                    {saveOrder.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Banknote className="w-5 h-5" />
                    )}
                    Zahlt mit Bar
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

  return (
    <div className="h-full min-h-0 relative w-full">
      {/* Vollflächige Karte */}
      <div className="absolute inset-0">
        <DeliveryMap
          pins={pins}
          routes={mapRoutes}
          onRouteInfo={handleRouteInfo}
          className="absolute inset-0"
        />
        {pins.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-sm text-white/80">
            Noch keine Lieferungen auf der Karte
          </div>
        )}
      </div>

      {/* Kopf */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 lg:px-6 pt-4 pb-3 pointer-events-none [&>*]:pointer-events-auto">
        <div className="min-w-0 flex-1 glass-map rounded-2xl px-4 py-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Piratino</div>
          <h1 className="text-xl font-semibold">Lieferkarte</h1>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs glass-map rounded-2xl px-4 py-3">
          <Legend color="bg-amber-500" label={`Zu erledigen (${todoOrders.length})`} />
          <Legend color="bg-sky-400" label={`Unterwegs (${enrouteOrders.length})`} />
          <Legend color="bg-emerald-400" label={`Kuriere (${courierLocations.length})`} />
        </div>

        <button
          onClick={() => {
            resetAll();
            setShowWizard(true);
          }}
          className="rounded-2xl px-4 py-3 text-sm font-semibold bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground flex items-center gap-2 active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" /> Neue Bestellung
        </button>
      </header>

      <div className="absolute inset-0 z-10 pointer-events-none px-4 lg:px-6 pt-24 pb-4 flex justify-end">
        {/* Listen als Overlay über der Karte */}
        <div className="pointer-events-auto w-full sm:max-w-[380px] min-h-0 max-h-full overflow-y-auto space-y-4 pb-24 lg:pb-0">

          <OrderGroup
            title="Zu erledigen"
            dot="bg-amber-500"
            orders={todoOrders}
            couriers={couriers}
            onAssign={(orderId, courierId) => assignCourier.mutate({ orderId, courierId })}
          />
          <OrderGroup
            title="Unterwegs"
            dot="bg-sky-400"
            orders={enrouteOrders}
            couriers={couriers}
            routeInfo={routeInfo}
            onAssign={(orderId, courierId) => assignCourier.mutate({ orderId, courierId })}
          />
          <section className="glass-map rounded-3xl p-4">
            <h2 className="font-semibold mb-3 text-sm">Kuriere</h2>
            {courierLocations.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Noch keine Standorte. Kuriere müssen die Kurier-Seite offen haben und den Standort freigeben.
              </div>
            ) : (
              <div className="space-y-2">
                {courierLocations.map((l: any) => {
                  const load = enrouteOrders.filter((o) => o.courier_id === l.member_id);
                  return (
                    <div key={l.member_id} className="glass rounded-xl px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium flex items-center gap-1.5">
                          <Bike className="w-3.5 h-3.5 text-emerald-400" />
                          {l.team_members?.name ?? "Kurier"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(l.updated_at).toLocaleTimeString("de-CH", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {load.length === 0
                          ? "Keine aktive Lieferung"
                          : load.map((o: any) => o.delivery_address ?? "Lieferung").join(" · ")}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="glass-map rounded-3xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Heute erledigt</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {doneOrders.length} · CHF {doneOrders.reduce((s, o) => s + Number(o.total || 0), 0).toFixed(2)}
              </span>
            </div>
            {doneOrders.length === 0 ? (
              <div className="text-xs text-muted-foreground">Heute noch nichts geliefert.</div>
            ) : (
              <div className="space-y-2">
                {doneOrders.map((o: any) => (
                  <div key={o.id} className="glass rounded-xl px-3 py-2 text-sm flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate">{o.delivery_address ?? "Lieferung"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.opened_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                        {o.courier_name ? ` · ${o.courier_name}` : ""}
                      </div>
                    </div>
                    <span className="tabular-nums font-semibold shrink-0">CHF {Number(o.total).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Mobile: neue Bestellung unten */}
      <button
        onClick={() => {
          resetAll();
          setShowWizard(true);
        }}
        className="lg:hidden fixed bottom-20 right-4 z-30 rounded-full px-5 py-4 shadow-2xl bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-semibold flex items-center gap-2"
      >
        <Plus className="w-4 h-4" /> Bestellung
      </button>

      {/* Wizard als Overlay */}
      <AnimatePresence>
        {showWizard && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed inset-0 z-40 bg-background/95 backdrop-blur-md"
          >
            <button
              onClick={() => setShowWizard(false)}
              className="absolute top-4 right-4 z-50 w-11 h-11 rounded-xl glass flex items-center justify-center"
              aria-label="Schliessen"
            >
              <X className="w-5 h-5" />
            </button>
            {wizard}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 glass rounded-full px-2.5 py-1 text-xs">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function OrderGroup({
  title,
  dot,
  orders,
  couriers,
  routeInfo = {},
  onAssign,
}: {
  title: string;
  dot: string;
  orders: any[];
  couriers: any[];
  routeInfo?: Record<string, { km: number; minutes: number }>;
  onAssign: (orderId: string, courierId: string | null) => void;
}) {
  return (
    <section className="glass-strong rounded-3xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        <h2 className="font-semibold text-sm">
          {title} ({orders.length})
        </h2>
      </div>
      {orders.length === 0 ? (
        <div className="text-xs text-muted-foreground">Nichts vorhanden.</div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="glass rounded-xl px-3 py-2 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm min-w-0">
                  <div className="truncate">{o.delivery_address ?? "Lieferung"}</div>
                  {o.delivery_note && (
                    <div className="text-xs text-muted-foreground truncate">{o.delivery_note}</div>
                  )}
                  {o.customers && o.customers.lat == null && (
                    <div className="text-[10px] text-amber-400 flex items-center gap-1">
                      <MapPinIcon className="w-3 h-3" /> Adresse nicht auf Karte
                    </div>
                  )}
                  {routeInfo[o.id] && (
                    <div className="text-[11px] text-sky-300 flex items-center gap-1 mt-0.5 tabular-nums">
                      <Bike className="w-3 h-3" /> noch {routeInfo[o.id].km.toFixed(1)} km · ca.{" "}
                      {routeInfo[o.id].minutes} Min.
                    </div>
                  )}
                </div>

                <span className="text-sm font-semibold tabular-nums shrink-0">
                  CHF {Number(o.total).toFixed(2)}
                </span>
              </div>
              <select
                value={o.courier_id ?? ""}
                onChange={(e) => onAssign(o.id, e.target.value || null)}
                className="glass rounded-lg px-2 py-1.5 text-xs bg-transparent outline-none w-full"
              >
                <option value="">Kurier zuweisen…</option>
                {couriers.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </section>
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
            : `Offen — beim Kunden kassieren${
                receipt.payMethod === "cash" ? " (Bar)" : receipt.payMethod === "card" ? " (Karte)" : ""
              }`}

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

function MenuConfigDialog({
  item,
  onClose,
  onConfirm,
}: {
  item: DeliveryMenuItem & { category: string };
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const groups = item.modifierGroups ?? [];
  const [choices, setChoices] = useState<Record<string, string>>({});
  const complete = groups.every((g) => choices[g.label]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="glass-strong w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl p-5 max-h-[88vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-lg font-semibold">{item.name}</h3>
            {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
          </div>
          <span className="text-base font-semibold tabular-nums shrink-0">CHF {item.price.toFixed(2)}</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">{g.label}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {g.items.map((opt) => {
                  const active = choices[g.label] === opt.label;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => setChoices((c) => ({ ...c, [g.label]: opt.label }))}
                      className={`rounded-xl px-3 py-2.5 text-xs text-left transition-colors ${
                        active
                          ? "bg-accent text-accent-foreground font-semibold"
                          : "glass hover:border-accent/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-4">
          <button onClick={onClose} className="glass rounded-2xl px-4 py-3 text-sm flex-1">
            Abbrechen
          </button>
          <button
            disabled={!complete}
            onClick={() =>
              onConfirm(groups.map((g) => `${g.label.replace(" wählen", "")}: ${choices[g.label]}`).join(" · "))
            }
            className="rounded-2xl px-4 py-3 text-sm font-semibold flex-[2] bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground disabled:opacity-40"
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}
