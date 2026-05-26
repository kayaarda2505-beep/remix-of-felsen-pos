import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type TeamRole = "manager" | "barkeeper" | "service" | "kueche";

export interface Operator {
  id: string;
  name: string;
  role: TeamRole;
  color: string;
}

interface AuthState {
  session: Session | null;
  loading: boolean;
  operator: Operator | null;
  setOperator: (op: Operator | null) => void;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

const OPERATOR_KEY = "saints.operator";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [operator, setOperatorState] = useState<Operator | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(OPERATOR_KEY);
      return raw ? (JSON.parse(raw) as Operator) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // 1. Subscribe FIRST (avoid missed events during init)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setOperatorState(null);
        sessionStorage.removeItem(OPERATOR_KEY);
      }
    });

    // 2. Then hydrate existing session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const setOperator = (op: Operator | null) => {
    const prev = operator;
    // Check-out vorherigen Operator (alle offenen Einträge schliessen)
    if (prev && (!op || op.id !== prev.id)) {
      void supabase
        .from("time_entries")
        .update({ clock_out: new Date().toISOString() })
        .eq("member_id", prev.id)
        .is("clock_out", null);
    }
    // Check-in neuen Operator (nur wenn noch kein offener Eintrag)
    if (op && (!prev || op.id !== prev.id)) {
      void (async () => {
        const { data: existing } = await supabase
          .from("time_entries")
          .select("id")
          .eq("member_id", op.id)
          .is("clock_out", null)
          .limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from("time_entries").insert({ member_id: op.id });
        }
      })();
    }
    setOperatorState(op);
    if (op) sessionStorage.setItem(OPERATOR_KEY, JSON.stringify(op));
    else sessionStorage.removeItem(OPERATOR_KEY);
  };

  const signOut = async () => {
    setOperator(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthCtx.Provider value={{ session, loading, operator, setOperator, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>");
  return ctx;
}
