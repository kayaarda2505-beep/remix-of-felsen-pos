import { useState } from "react";
import { motion } from "motion/react";
import { Delete, ShieldCheck, LogOut, UserPlus, ArrowRight, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Operator } from "@/hooks/use-auth";
import { SaintsLogo } from "./SaintsLogo";

type Step = "account" | "pin";

export function TeamPinScreen() {
  const { setOperator, signOut } = useAuth();
  const [step, setStep] = useState<Step>("account");
  const [account, setAccount] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const resetAll = () => {
    setPin("");
    setAccount("");
    setStep("account");
  };

  const pressAccount = (n: string) => {
    setError(false);
    if (n === "del") {
      setAccount((a) => a.slice(0, -1));
      return;
    }
    if (n === "ok") {
      if (account.length > 0) setStep("pin");
      return;
    }
    if (account.length >= 4) return;
    setAccount((a) => a + n);
  };

  const pressPin = async (n: string) => {
    setError(false);
    if (n === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 6 || checking) return;
    const next = pin + n;
    setPin(next);

    if (next.length >= 4) {
      setChecking(true);
      try {
        const { data, error } = await supabase.rpc("verify_team_pin", {
          _account_number: Number(account),
          _pin: next,
        });
        if (error) throw error;
        const row = (data as Operator[] | null)?.[0];
        if (row) {
          setOperator(row);
        } else if (next.length === 6) {
          setError(true);
          setTimeout(() => setPin(""), 600);
        }
      } catch {
        setError(true);
        setTimeout(() => setPin(""), 600);
      } finally {
        setChecking(false);
      }
    }
  };

  const isAccount = step === "account";
  const value = isAccount ? account : pin;
  const maxDots = isAccount ? 4 : 6;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex justify-center mb-6">
          <SaintsLogo size={56} />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-center mb-1">
          Schicht starten
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          {isAccount ? "Kontonummer eingeben" : `Konto ${account} · PIN eingeben`}
        </p>

        <div className="glass-strong rounded-3xl p-6">
          {isAccount ? (
            <div className="flex items-center justify-center h-10 mb-7">
              <motion.span
                key={account || "empty"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-3xl font-semibold tracking-widest ${
                  error ? "text-destructive" : "text-foreground"
                }`}
              >
                {account || "—"}
              </motion.span>
            </div>
          ) : (
            <div className="flex justify-center gap-2.5 mb-7">
              {Array.from({ length: maxDots }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={
                    error
                      ? { x: [-4, 4, -4, 4, 0] }
                      : value.length > i
                        ? { scale: [1, 1.2, 1] }
                        : {}
                  }
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    value.length > i
                      ? error
                        ? "bg-destructive"
                        : "bg-accent"
                      : "bg-white/10"
                  }`}
                />
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", isAccount ? "ok" : "", "0", "del"].map(
              (k, i) =>
                k === "" ? (
                  <div key={i} />
                ) : (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.92 }}
                    disabled={checking || (k === "ok" && account.length === 0)}
                    onClick={() => (isAccount ? pressAccount(k) : pressPin(k))}
                    className="glass rounded-2xl py-5 text-xl font-medium hover:border-accent/30 transition-colors flex items-center justify-center disabled:opacity-40"
                  >
                    {k === "del" ? (
                      <Delete className="w-5 h-5" />
                    ) : k === "ok" ? (
                      <ArrowRight className="w-5 h-5 text-accent" />
                    ) : (
                      k
                    )}
                  </motion.button>
                ),
            )}
          </div>

          {checking && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5" /> Prüfe PIN…
            </div>
          )}

          {!isAccount && (
            <button
              onClick={resetAll}
              className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3 h-3" /> Andere Kontonummer
            </button>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            to="/staff"
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors text-center inline-flex items-center justify-center gap-1.5"
          >
            <UserPlus className="w-3 h-3" /> Team-Mitglied anlegen
          </Link>
          <button
            onClick={signOut}
            className="text-[11px] text-muted-foreground hover:text-destructive transition-colors text-center inline-flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3 h-3" /> Admin abmelden
          </button>
        </div>
      </motion.div>
    </div>
  );
}
