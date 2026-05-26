import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Banknote, CreditCard, Check, X, Clock, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/payments")({
  component: PaymentsPage,
});

type Method = "cash" | "card_terminal" | "stripe";

type Row = {
  id: string;
  table_id: string | null;
  table_name: string | null;
  order_id: string | null;
  amount: number;
  method: Method;
  status: "new" | "handled" | "paid" | "cancelled";
  note: string | null;
  created_at: string;
};

const methodLabel: Record<Method, string> = {
  cash: "Bar",
  card_terminal: "EC-Gerät am Tisch",
  stripe: "Online (Stripe)",
};

const methodOptions: { value: Method; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Bar", icon: Banknote },
  { value: "card_terminal", label: "Karte / EC", icon: CreditCard },
  { value: "stripe", label: "Online (Stripe)", icon: Smartphone },
];

function PaymentsPage() {
  const qc = useQueryClient();
  const [payingRow, setPayingRow] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [cashStep, setCashStep] = useState(false);
  const [givenStr, setGivenStr] = useState("");
  const [tipStr, setTipStr] = useState("0");

  const { data = [] } = useQuery<Row[]>({
    queryKey: ["payment_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_requests")
        .select("*")
        .in("status", ["new", "handled"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`payment_requests_page_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_requests" },
        () => qc.invalidateQueries({ queryKey: ["payment_requests"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const cancelRequest = async (id: string) => {
    const { error } = await supabase
      .from("payment_requests")
      .update({ status: "cancelled", handled_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Anfrage abgebrochen");
    qc.invalidateQueries({ queryKey: ["payment_requests"] });
  };

  const closeDialog = () => {
    setPayingRow(null);
    setCashStep(false);
    setGivenStr("");
    setTipStr("0");
  };

  const pickMethod = (method: Method) => {
    if (method === "cash") {
      setGivenStr(payingRow ? Number(payingRow.amount).toFixed(2) : "");
      setTipStr("0");
      setCashStep(true);
      return;
    }
    confirmPaid(method);
  };

  const confirmPaid = async (method: Method, extra?: { tip: number; given: number }) => {
    if (!payingRow) return;
    setBusy(true);
    try {
      const noteParts: string[] = [];
      if (extra) {
        noteParts.push(`Gegeben CHF ${extra.given.toFixed(2)}`);
        if (extra.tip > 0) noteParts.push(`Trinkgeld CHF ${extra.tip.toFixed(2)}`);
        const change = extra.given - Number(payingRow.amount) - extra.tip;
        if (change > 0) noteParts.push(`Rückgeld CHF ${change.toFixed(2)}`);
      }
      const note = noteParts.length ? noteParts.join(" · ") : payingRow.note;

      const { error } = await supabase
        .from("payment_requests")
        .update({
          status: "paid",
          method,
          note,
          handled_at: new Date().toISOString(),
        })
        .eq("id", payingRow.id);
      if (error) throw error;

      if (payingRow.order_id) {
        const { error: oErr } = await supabase
          .from("orders")
          .update({ status: "paid", closed_at: new Date().toISOString() })
          .eq("id", payingRow.order_id);
        if (oErr) throw oErr;
      }

      toast.success(`Als bezahlt (${methodLabel[method]}) markiert`);
      closeDialog();
      qc.invalidateQueries({ queryKey: ["payment_requests"] });
      qc.invalidateQueries({ queryKey: ["orders_day"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const submitCash = () => {
    if (!payingRow) return;
    const amount = Number(payingRow.amount);
    const given = Number(givenStr.replace(",", "."));
    const tip = Math.max(0, Number(tipStr.replace(",", ".")) || 0);
    if (!Number.isFinite(given) || given < amount) {
      toast.error(`Gegebener Betrag muss mindestens CHF ${amount.toFixed(2)} sein`);
      return;
    }
    if (tip > given - amount + 0.001) {
      toast.error("Trinkgeld grösser als Rückgeld");
      return;
    }
    confirmPaid("cash", { given, tip });
  };

  return (
    <>
      <div className="min-h-screen p-4 md:p-6 pb-28 md:pb-10 max-w-4xl mx-auto">
        <header className="mb-5 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Bezahl-Anfragen</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Gäste, die vom Tisch aus zahlen möchten — Bar, EC-Gerät oder online.
          </p>
        </header>

        {data.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
            Keine offenen Bezahl-Anfragen.
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {data.map((r) => {
                const Icon = r.method === "cash" ? Banknote : CreditCard;
                const isNew = r.status === "new";
                return (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`glass rounded-2xl p-3 md:p-4 flex flex-wrap items-center gap-3 md:gap-4 ${
                      isNew ? "ring-1 ring-accent/40 shadow-[var(--shadow-gold)]" : "opacity-80"
                    }`}
                  >
                    <div
                      className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        isNew ? "bg-accent/20 text-accent" : "bg-white/5 text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm md:text-base">Tisch {r.table_name ?? "?"}</div>
                      <div className="text-[11px] md:text-xs text-muted-foreground truncate">
                        {methodLabel[r.method]} ·{" "}
                        <span className="tabular-nums">CHF {Number(r.amount).toFixed(2)}</span>
                      </div>
                      {r.note && (
                        <div className="text-[11px] italic text-muted-foreground mt-0.5 truncate">„{r.note}"</div>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground hidden sm:flex items-center gap-1 mr-2">
                      <Clock className="w-3 h-3" />
                      {new Date(r.created_at).toLocaleTimeString("de-CH", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="flex gap-1.5 w-full sm:w-auto">
                      <button
                        onClick={() => setPayingRow(r)}
                        className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-success/20 text-success text-xs font-medium hover:bg-success/30 flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Bezahlt
                      </button>
                      <button
                        onClick={() => cancelRequest(r.id)}
                        className="px-3 py-2 rounded-xl bg-white/5 hover:bg-destructive/20 hover:text-destructive text-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {payingRow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !busy && closeDialog()}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-strong rounded-3xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Tisch {payingRow.table_name ?? "?"}
                </div>
                <div className="text-3xl font-semibold tabular-nums mt-1">
                  CHF {Number(payingRow.amount).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {cashStep ? "Bar bezahlt — wie viel gegeben?" : "Womit wurde bezahlt?"}
                </div>
              </div>

              {!cashStep && (
                <div className="space-y-2">
                  {methodOptions.map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.value}
                        disabled={busy}
                        onClick={() => pickMethod(m.value)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-success/20 hover:text-success transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        <Icon className="w-5 h-5" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {cashStep && (() => {
                const amount = Number(payingRow.amount);
                const given = Number(givenStr.replace(",", ".")) || 0;
                const tip = Math.max(0, Number(tipStr.replace(",", ".")) || 0);
                const diff = given - amount;
                const change = Math.max(0, diff - tip);
                const quick = [
                  Math.ceil(amount),
                  Math.ceil(amount / 10) * 10,
                  Math.ceil(amount / 20) * 20,
                  Math.ceil(amount / 50) * 50,
                ].filter((v, i, arr) => v >= amount && arr.indexOf(v) === i);
                return (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Gegeben (CHF)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.05"
                        min={amount}
                        value={givenStr}
                        onChange={(e) => setGivenStr(e.target.value)}
                        className="w-full mt-1 bg-white/5 rounded-xl px-4 py-3 text-2xl font-semibold tabular-nums outline-none focus:ring-2 ring-accent/40"
                        autoFocus
                      />
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {quick.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setGivenStr(q.toFixed(2))}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs tabular-nums"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Trinkgeld
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.05"
                          min={0}
                          max={diff > 0 ? diff : 0}
                          value={tipStr}
                          onChange={(e) => setTipStr(e.target.value)}
                          className="w-full mt-1 bg-white/5 rounded-xl px-3 py-2 text-lg tabular-nums outline-none focus:ring-2 ring-accent/40"
                        />
                        {diff > 0 && (
                          <button
                            type="button"
                            onClick={() => setTipStr(diff.toFixed(2))}
                            className="text-[10px] text-accent mt-1 hover:underline"
                          >
                            Rest als Trinkgeld
                          </button>
                        )}
                      </div>
                      <div>
                        <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Rückgeld
                        </label>
                        <div className="mt-1 px-3 py-2 rounded-xl bg-white/5 text-lg tabular-nums font-semibold">
                          CHF {change.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <button
                      disabled={busy || given < amount}
                      onClick={submitCash}
                      className="w-full py-3 rounded-xl bg-success/20 text-success font-medium hover:bg-success/30 disabled:opacity-40"
                    >
                      Bestätigen
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setCashStep(false)}
                      className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      ← Andere Methode
                    </button>
                  </div>
                );
              })()}

              {!cashStep && (
                <button
                  disabled={busy}
                  onClick={closeDialog}
                  className="w-full mt-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Abbrechen
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
