import { useState, type FormEvent } from "react";
import { Loader2, Mail, Lock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SaintsLogo } from "./SaintsLogo";

type Mode = "login" | "signup";

export function AdminAuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      if (msg.includes("Invalid login")) setError("E-Mail oder Passwort falsch.");
      else if (msg.includes("already registered")) setError("Diese E-Mail ist bereits registriert. Wechsle zu Anmelden.");
      else if (msg.includes("Password should be")) setError("Passwort muss mindestens 6 Zeichen haben.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <SaintsLogo size={72} />
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-center mb-1">
          SAINTS POS
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          {mode === "login" ? "Admin-Anmeldung" : "Erstes Admin-Konto einrichten"}
        </p>

        <form onSubmit={submit} className="glass-strong rounded-3xl p-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="admin-email" className="text-xs uppercase tracking-wider text-muted-foreground">
              E-Mail
            </label>
            <div className="glass rounded-xl flex items-center gap-2 px-3 py-3">
              <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@saints.bar"
                className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-password" className="text-xs uppercase tracking-wider text-muted-foreground">
              Passwort
            </label>
            <div className="glass rounded-xl flex items-center gap-2 px-3 py-3">
              <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                id="admin-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl py-3.5 bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-semibold shadow-[var(--shadow-gold)] flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {mode === "login" ? "Anmelden" : "Admin-Konto erstellen"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {mode === "signup" && (
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
            >
              ← Zurück zur Anmeldung
            </button>
          )}
        </form>

        <p className="text-[10px] text-muted-foreground text-center mt-6 tracking-wider uppercase">
          Nur Admins & Manager melden sich hier an.
          <br />
          Service & Bar nutzen einen PIN.
        </p>
      </div>
    </div>
  );
}
