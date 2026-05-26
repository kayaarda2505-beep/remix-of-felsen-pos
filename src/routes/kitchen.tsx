import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, ChefHat, Wine, Inbox, BookOpen, X } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { routeForCategory } from "@/lib/receipt";
import { getTutorial, type CocktailTutorial } from "@/lib/cocktailTutorials";

export const Route = createFileRoute("/kitchen")({
  head: () => ({ meta: [{ title: "Küche & Bar — SAINTS POS" }] }),
  component: KitchenView,
});

type Station = "bar" | "kueche";

interface TicketItem {
  id: string;
  product_id: string;
  product_name: string;
  qty: number;
  note: string | null;
  modifiers: string[];
  category: string | null;
}

interface Ticket {
  key: string;             // `${order_id}-${station}-${batch}`
  orderId: string;
  station: Station;
  tableName: string;
  items: TicketItem[];
  firstSent: number;       // ms timestamp of earliest item
  batch: number;           // bucket timestamp (sent_at rounded to 5s)
}

interface RawItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  qty: number;
  note: string | null;
  modifiers: unknown;
  category: string | null;
  sent_at: string;
}

const ACK_KEY = "kitchen.acked.v1";
const loadAcked = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(ACK_KEY) ?? "{}"); } catch { return {}; }
};
const saveAcked = (m: Record<string, number>) => localStorage.setItem(ACK_KEY, JSON.stringify(m));

function KitchenView() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "bar" | "kueche">("all");
  const [tick, setTick] = useState(0);
  const [acked, setAcked] = useState<Record<string, number>>(() => loadAcked());
  const [tutorial, setTutorial] = useState<CocktailTutorial | null>(null);

  // 1-Sekunden-Tick für Elapsed-Anzeige
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Offene Orders + ihre Items
  const { data: rawItems = [] } = useQuery<RawItem[]>({
    queryKey: ["kitchen", "open-items"],
    queryFn: async () => {
      const { data: orders, error: oErr } = await supabase
        .from("orders")
        .select("id")
        .eq("status", "open");
      if (oErr) throw oErr;
      const ids = (orders ?? []).map((o) => o.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("order_items")
        .select("id, order_id, product_id, product_name, qty, note, modifiers, category, sent_at")
        .in("order_id", ids)
        .order("sent_at");
      if (error) throw error;
      return (data ?? []) as RawItem[];
    },
    refetchInterval: 4000,
  });

  // Tischnamen für die Order-IDs
  const orderIds = useMemo(() => Array.from(new Set(rawItems.map((i) => i.order_id))), [rawItems]);
  const { data: orderMap = {} } = useQuery<Record<string, string>>({
    queryKey: ["kitchen", "order-tables", orderIds.join(",")],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, table_id, dining_tables:table_id(name)")
        .in("id", orderIds);
      if (error) throw error;
      const m: Record<string, string> = {};
      (data ?? []).forEach((r: { id: string; dining_tables: { name: string } | null }) => {
        m[r.id] = r.dining_tables?.name ?? "Direkt";
      });
      return m;
    },
  });

  // Realtime: bei neuen order_items sofort neu laden
  useEffect(() => {
    const ch = supabase
      .channel("kitchen-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        qc.invalidateQueries({ queryKey: ["kitchen"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["kitchen"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // Tickets aufbauen: pro Order × Station × Bestell-Batch ein eigenes Ticket
  // Items die innerhalb von 5 Sekunden gesendet wurden gehören zum gleichen Batch.
  const BATCH_WINDOW_MS = 5000;
  const tickets: Ticket[] = useMemo(() => {
    const map = new Map<string, Ticket>();
    // sortiert nach sent_at (kommt schon sortiert aus der Query)
    for (const it of rawItems) {
      const station: Station = routeForCategory(it.category);
      const sentMs = new Date(it.sent_at).getTime();
      // Suche existierendes Ticket für (order, station) das im Batch-Fenster liegt
      let ticket: Ticket | undefined;
      for (const t of map.values()) {
        if (t.orderId === it.order_id && t.station === station &&
            Math.abs(sentMs - t.batch) <= BATCH_WINDOW_MS) {
          ticket = t;
          break;
        }
      }
      const batch = ticket ? ticket.batch : sentMs;
      const key = `${it.order_id}-${station}-${batch}`;
      if (acked[key] && batch <= acked[key]) continue;
      if (!ticket) {
        ticket = {
          key,
          orderId: it.order_id,
          station,
          tableName: orderMap[it.order_id] ?? "…",
          items: [],
          firstSent: sentMs,
          batch,
        };
        map.set(key, ticket);
      }
      ticket.items.push({
        id: it.id,
        product_id: it.product_id,
        product_name: it.product_name,
        qty: it.qty,
        note: it.note,
        modifiers: Array.isArray(it.modifiers) ? (it.modifiers as string[]) : [],
        category: it.category,
      });
      ticket.firstSent = Math.min(ticket.firstSent, sentMs);
    }
    return Array.from(map.values()).sort((a, b) => a.firstSent - b.firstSent);
  }, [rawItems, orderMap, acked]);

  const visible = tickets.filter((t) => filter === "all" || t.station === filter);

  const ackTicket = (key: string) => {
    const next = { ...acked, [key]: Date.now() };
    setAcked(next);
    saveAcked(next);
  };

  const now = Date.now();
  // tick wird benutzt um Re-Renders auszulösen
  void tick;

  return (
    <div className="p-6 lg:p-10 pb-28 md:pb-10 max-w-[1800px] mx-auto">
      <PageHeader
        title="Küche & Bar"
        subtitle="Live Bestellungen — automatisch nach Station sortiert"
        actions={
          <div className="glass rounded-xl p-1 flex gap-1">
            {(["all", "bar", "kueche"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  filter === f ? "bg-white/10" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "bar" && <Wine className="w-3 h-3" />}
                {f === "kueche" && <ChefHat className="w-3 h-3" />}
                {f === "all" ? "Alle" : f === "bar" ? "Bar" : "Küche"}
              </button>
            ))}
          </div>
        }
      />

      {visible.length === 0 ? (
        <div className="glass rounded-3xl flex flex-col items-center justify-center text-center py-24 px-6">
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <Inbox className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">Keine offenen Tickets</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Neue Bestellungen aus dem Service erscheinen hier in Echtzeit.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visible.map((t, i) => {
            const minutes = Math.max(0, Math.floor((now - t.firstSent) / 60000));
            const urgent = minutes >= 10;
            return (
              <motion.div
                key={t.key}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className={`glass rounded-3xl p-5 border-2 flex flex-col gap-3 ${
                  urgent ? "border-warning/50 shadow-[0_0_30px_-10px] shadow-warning" : "border-white/10"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">#{t.orderId.slice(0, 6)}</div>
                    <div className="text-lg font-semibold">{t.tableName}</div>
                  </div>
                  <div className="text-right">
                    <div className={`flex items-center gap-1 text-xs ${urgent ? "text-warning" : "text-muted-foreground"}`}>
                      <Clock className="w-3 h-3" />
                      <span className="tabular-nums">{minutes} Min</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] mt-1 px-2 py-0.5 rounded-md bg-white/5">
                      {t.station === "bar" ? <Wine className="w-3 h-3" /> : <ChefHat className="w-3 h-3" />}
                      {t.station === "bar" ? "Bar" : "Küche"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 flex-1">
                  {t.items.map((item) => {
                    const tut = getTutorial(item.product_id);
                    return (
                      <div key={item.id} className="flex items-start gap-2 text-sm">
                        <span className="font-mono tabular-nums w-6 shrink-0">{item.qty}×</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{item.product_name}</span>
                            {tut && (
                              <button
                                onClick={() => setTutorial(tut)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-medium transition-colors"
                              >
                                <BookOpen className="w-3 h-3" />
                                Tutorial
                              </button>
                            )}
                          </div>
                          {item.modifiers.length > 0 && (
                            <div className="text-xs text-muted-foreground">{item.modifiers.join(", ")}</div>
                          )}
                          {item.note && (
                            <div className="text-xs text-warning italic">↳ {item.note}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => ackTicket(t.key)}
                  className="w-full rounded-xl py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Erledigt
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {tutorial && <TutorialDialog tutorial={tutorial} onClose={() => setTutorial(null)} />}
      </AnimatePresence>
    </div>
  );
}

function TutorialDialog({ tutorial, onClose }: { tutorial: CocktailTutorial; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero-Bild */}
        <div className="relative">
          <img
            src={tutorial.image}
            alt={tutorial.name}
            loading="lazy"
            width={768}
            height={768}
            className="w-full h-64 object-cover rounded-t-3xl"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent rounded-t-3xl" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur hover:bg-black/70 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-4 left-6 right-6">
            <h2 className="text-3xl font-semibold drop-shadow">{tutorial.name}</h2>
            <div className="flex gap-1.5 flex-wrap mt-2">
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/15 backdrop-blur">{tutorial.technique}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/15 backdrop-blur">{tutorial.prepTime}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/15 backdrop-blur">{tutorial.difficulty}</span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Glas + Eis */}
          <section className="grid grid-cols-2 gap-3">
            <div className="px-4 py-3 rounded-2xl bg-white/5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Glas</div>
              <div className="text-sm font-medium">{tutorial.glass.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{tutorial.glass.detail}</div>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white/5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Eis</div>
              <div className="text-sm font-medium">{tutorial.ice.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{tutorial.ice.detail}</div>
            </div>
          </section>

          {/* Zutaten */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Zutaten</h3>
            <div className="space-y-1.5">
              {tutorial.ingredients.map((ing, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 px-4 py-2.5 rounded-xl bg-white/5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{ing.label}</div>
                    {ing.note && <div className="text-[11px] text-muted-foreground italic">{ing.note}</div>}
                  </div>
                  <div className="text-sm font-mono tabular-nums shrink-0">{ing.amount}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Schritte */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Zubereitung</h3>
            <ol className="space-y-2">
              {tutorial.steps.map((s, idx) => (
                <li key={idx} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/5">
                  <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-mono shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{s.title}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{s.text}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Garnitur + Service */}
          <section className="grid grid-cols-2 gap-3">
            <div className="px-4 py-3 rounded-2xl bg-white/5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Garnitur</div>
              <div className="text-sm">{tutorial.garnish}</div>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white/5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Service</div>
              <div className="text-sm">{tutorial.service}</div>
            </div>
          </section>

          {/* Tipps */}
          {tutorial.tips && tutorial.tips.length > 0 && (
            <section className="px-4 py-3 rounded-2xl bg-warning/10 border border-warning/30">
              <div className="text-[10px] uppercase tracking-wider text-warning mb-1.5">Profi-Tipps</div>
              <ul className="space-y-1">
                {tutorial.tips.map((tip, idx) => (
                  <li key={idx} className="text-sm flex gap-2">
                    <span className="text-warning shrink-0">›</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

