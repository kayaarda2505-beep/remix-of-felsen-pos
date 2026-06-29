import { useEffect, useState, useRef, useCallback } from "react";
import { Bell, CreditCard, X } from "lucide-react";

export type UrgentAlert = {
  id: string;
  kind: "service" | "payment";
  title: string;
  description?: string;
  href?: string;
};

type Listener = (alerts: UrgentAlert[]) => void;

const state: { queue: UrgentAlert[] } = { queue: [] };
const listeners = new Set<Listener>();
const seen = new Set<string>();

function emit() {
  for (const l of listeners) l([...state.queue]);
}

export function pushUrgentAlert(alert: UrgentAlert) {
  if (seen.has(alert.id)) return;
  seen.add(alert.id);
  state.queue.push(alert);
  emit();
}

export function dismissUrgentAlert(id: string) {
  state.queue = state.queue.filter((a) => a.id !== id);
  emit();
}

function useUrgentAlerts() {
  const [alerts, setAlerts] = useState<UrgentAlert[]>(state.queue);
  useEffect(() => {
    listeners.add(setAlerts);
    return () => {
      listeners.delete(setAlerts);
    };
  }, []);
  return alerts;
}

/**
 * Loops a loud Web Audio ring while any alert is in the queue.
 * Plays a two-tone "ding-dong" pattern at ~0.85 gain — much louder than
 * the regular notification sounds.
 */
function useLoopingRing(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  const ring = useCallback(() => {
    try {
      let ctx = ctxRef.current;
      if (!ctx) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        ctx = new Ctx();
        ctxRef.current = ctx;
      }
      if (ctx.state === "suspended") void ctx.resume();
      const master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);

      const tone = (freq: number, start: number, dur: number) => {
        const o = ctx!.createOscillator();
        const g = ctx!.createGain();
        o.type = "square";
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, ctx!.currentTime + start);
        g.gain.exponentialRampToValueAtTime(0.9, ctx!.currentTime + start + 0.02);
        g.gain.setValueAtTime(0.9, ctx!.currentTime + start + dur - 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx!.currentTime + start + dur);
        o.connect(g);
        g.connect(master);
        o.start(ctx!.currentTime + start);
        o.stop(ctx!.currentTime + start + dur + 0.02);
      };
      // Ding-dong pattern — Uber-style insistent
      tone(988, 0, 0.35);   // B5
      tone(740, 0.4, 0.45); // F#5
      tone(988, 0.95, 0.35);
      tone(740, 1.35, 0.5);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!active) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    ring();
    timerRef.current = window.setInterval(ring, 2000);
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, ring]);
}

export function UrgentAlertOverlay() {
  const alerts = useUrgentAlerts();
  const active = alerts.length > 0;
  useLoopingRing(active);

  // Also vibrate phones in a loop (best-effort, no-op on desktop)
  useEffect(() => {
    if (!active) return;
    const v = () => {
      try {
        navigator.vibrate?.([400, 200, 400, 200, 600]);
      } catch {
        // ignore
      }
    };
    v();
    const id = window.setInterval(v, 2000);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active) return null;
  const top = alerts[0];
  const Icon = top.kind === "payment" ? CreditCard : Bell;
  const accent =
    top.kind === "payment"
      ? "from-emerald-500 to-emerald-700"
      : "from-rose-500 to-rose-700";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
        <div
          className={`bg-gradient-to-br ${accent} text-white p-8 flex flex-col items-center text-center gap-3`}
        >
          <Icon className="w-16 h-16 animate-pulse" strokeWidth={1.5} />
          <div className="text-2xl font-bold">{top.title}</div>
          {top.description && (
            <div className="text-base opacity-95">{top.description}</div>
          )}
          {alerts.length > 1 && (
            <div className="text-xs uppercase tracking-wider opacity-90 mt-1">
              +{alerts.length - 1} weitere
            </div>
          )}
        </div>
        <div className="p-4 flex gap-2">
          {top.href && (
            <button
              onClick={() => {
                const href = top.href!;
                dismissUrgentAlert(top.id);
                window.location.href = href;
              }}
              className="flex-1 rounded-xl bg-accent text-accent-foreground py-4 font-semibold text-lg hover:opacity-90 transition-opacity"
            >
              Öffnen
            </button>
          )}
          <button
            onClick={() => dismissUrgentAlert(top.id)}
            className="flex-1 rounded-xl bg-white/10 hover:bg-white/15 py-4 font-semibold text-lg transition-colors flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            Bestätigen
          </button>
        </div>
      </div>
    </div>
  );
}
