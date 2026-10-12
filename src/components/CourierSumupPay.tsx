import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, Loader2 } from "lucide-react";
import { sumupGetTransactionStatus, sumupSendToReader } from "@/lib/sumup.functions";

type Phase = "idle" | "sending" | "waiting" | "success" | "failed";

export function CourierSumupPay({ defaultAmount, orderLabel }: { defaultAmount: number; orderLabel: string }) {
  const send = useServerFn(sumupSendToReader);
  const getStatus = useServerFn(sumupGetTransactionStatus);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(defaultAmount > 0 ? defaultAmount.toFixed(2) : "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const [txId, setTxId] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== "waiting" || !txId) return;
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      if (stop) return;
      try {
        const r = await getStatus({ data: { clientTransactionId: txId } });
        if (r.status === "SUCCESSFUL") {
          setPhase("success");
          setMsg(`Zahlung erfolgreich: CHF ${(r.amount ?? Number(amount)).toFixed(2)}`);
          return;
        }
        if (r.status === "FAILED" || r.status === "CANCELLED") {
          setPhase("failed");
          setMsg(r.status === "CANCELLED" ? "Zahlung abgebrochen" : "Zahlung fehlgeschlagen");
          return;
        }
      } catch {}
      if (Date.now() - started > 180_000) {
        setPhase("failed");
        setMsg("Keine Rückmeldung vom Gerät – bitte am Terminal prüfen");
        return;
      }
      setTimeout(tick, 3000);
    };
    const t = setTimeout(tick, 3000);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [phase, txId]);

  const submit = async () => {
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setPhase("failed");
      setMsg("Bitte gültigen Betrag eingeben");
      return;
    }
    setPhase("sending");
    setMsg("");
    try {
      const r = await send({ data: { amount: Math.round(value * 100) / 100, description: orderLabel } });
      if (r.clientTransactionId) {
        setTxId(r.clientTransactionId);
        setPhase("waiting");
        setMsg("Betrag an Gerät gesendet – Kunde bezahlt am Terminal…");
      } else {
        setPhase("success");
        setMsg("Betrag an Gerät gesendet");
      }
    } catch (e) {
      setPhase("failed");
      setMsg((e as Error).message);
    }
  };

  return (
    <section className="glass-strong rounded-3xl p-5">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 text-left">
        <CreditCard className="w-5 h-5 text-accent" />
        <span className="font-semibold">Zahlung empfangen über SumUp</span>
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-muted-foreground">Betrag (CHF)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.05"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl bg-background/60 border border-border px-4 py-3 text-2xl font-semibold tabular-nums"
            placeholder="0.00"
          />
          <button
            onClick={submit}
            disabled={phase === "sending" || phase === "waiting"}
            className="w-full rounded-2xl py-4 bg-accent text-accent-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {(phase === "sending" || phase === "waiting") && <Loader2 className="w-4 h-4 animate-spin" />}
            An SumUp-Gerät senden
          </button>
          {msg && (
            <div
              role={phase === "failed" ? "alert" : undefined}
              className={`rounded-xl text-xs px-3 py-2 text-center ${
                phase === "failed"
                  ? "bg-destructive/10 text-destructive"
                  : phase === "success"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-accent/10 text-accent"
              }`}
            >
              {msg}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
