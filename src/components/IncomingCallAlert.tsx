import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bike, PhoneIncoming, ShoppingBag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Call = {
  id: string;
  phone: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_address: string | null;
  handled_at: string | null;
};

export type CallStart = { mode: "delivery" | "takeaway"; phone: string; customerId: string | null; name: string | null };
export const CALL_START_KEY = "piratino-call-start";
export const CALL_START_EVENT = "piratino-call-start";

/** Eingehender Anruf: Popup auf allen Kassen-Bildschirmen, dann Bestellfenster vorausgefüllt. */
export function IncomingCallAlert() {
  const [queue, setQueue] = useState<Call[]>([]);
  const navigate = useNavigate();

  const remove = useCallback((id: string) => setQueue((q) => q.filter((c) => c.id !== id)), []);

  useEffect(() => {
    const load = async () => {
      const since = new Date(Date.now() - 3 * 60_000).toISOString();
      const { data } = await (supabase as any)
        .from("incoming_calls").select("*").is("handled_at", null).gte("created_at", since).order("created_at");
      setQueue((data ?? []) as Call[]);
    };
    void load();
    const ch = supabase
      .channel(`calls_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incoming_calls" }, (p: any) => {
        const r = p.new as Call;
        setQueue((q) => (q.some((x) => x.id === r.id) ? q : [...q, r]));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "incoming_calls" }, (p: any) => {
        if (p.new?.handled_at) remove(p.new.id);
      })
      .subscribe();
    const poll = window.setInterval(load, 10_000);
    return () => {
      supabase.removeChannel(ch);
      window.clearInterval(poll);
    };
  }, [remove]);

  const call = queue[0];
  if (!call) return null;

  const handle = async (mode: "delivery" | "takeaway" | null) => {
    remove(call.id);
    await (supabase as any).from("incoming_calls").update({ handled_at: new Date().toISOString() }).eq("id", call.id);
    if (!mode) return;
    const start: CallStart = { mode, phone: call.phone, customerId: call.customer_id, name: call.customer_name };
    sessionStorage.setItem(CALL_START_KEY, JSON.stringify(start));
    window.dispatchEvent(new CustomEvent(CALL_START_EVENT));
    void navigate({ to: "/lieferung" });
  };

  const found = !!call.customer_id;
  return (
    <div className="fixed inset-0 z-[90] bg-background/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-strong rounded-3xl p-6 w-full max-w-md space-y-4 border border-accent/40">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center animate-pulse">
              <PhoneIncoming className="w-6 h-6 text-accent" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Eingehender Anruf</div>
              <div className="text-lg font-semibold">{found ? "Kunde wurde gefunden" : "Neuer Kunde"}</div>
            </div>
          </div>
          <button onClick={() => handle(null)} className="w-9 h-9 rounded-xl glass flex items-center justify-center" aria-label="Schliessen">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="glass rounded-2xl p-4 space-y-1">
          {found && <div className="font-medium">{call.customer_name || "Kunde"}</div>}
          {found && call.customer_address && <div className="text-sm text-muted-foreground">{call.customer_address}</div>}
          <div className="text-base tabular-nums">{call.phone}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => handle("delivery")} className="rounded-2xl py-5 bg-primary text-primary-foreground flex flex-col items-center gap-1.5 font-medium">
            <Bike className="w-5 h-5" /> Kurier
          </button>
          <button onClick={() => handle("takeaway")} className="rounded-2xl py-5 glass flex flex-col items-center gap-1.5 font-medium">
            <ShoppingBag className="w-5 h-5" /> Takeaway
          </button>
        </div>
        {queue.length > 1 && <div className="text-xs text-center text-muted-foreground">+{queue.length - 1} weitere Anrufe</div>}
      </div>
    </div>
  );
}
