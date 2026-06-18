import { Link, useRouterState } from "@tanstack/react-router";
import {
  Tablet,
  ScanLine,
  Grid3x3,
  ChefHat,
  Users,
  Package,
  BarChart3,
  Settings,
  LogOut,
  CalendarDays,
  Music,
  Receipt,
  Wallet,
  Banknote,
} from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { SaintsLogo } from "./SaintsLogo";
import { SpotifyPlayer } from "./SpotifyPlayer";
import { supabase } from "@/integrations/supabase/client";
import { isDesktopApp } from "@/lib/printer-bridge";
import { printBill } from "@/lib/receipt";
import { SpotifyBarSpeakerProvider } from "@/components/SpotifyBarSpeaker";

async function autoPrintPaidBill(r: any) {
  if (!isDesktopApp()) return;
  try {
    const { data: printers } = await supabase
      .from("printers")
      .select("id, name, type, ip_address, port")
      .eq("active", true);
    if (!printers?.length) return;

    let items: Array<{ product_name: string; qty: number; unit_price: number; modifiers?: string[] }> = [];
    if (r.order_id) {
      const { data: oi } = await supabase
        .from("order_items")
        .select("product_name, qty, unit_price, modifiers")
        .eq("order_id", r.order_id);
      items = (oi ?? []).map((it: any) => ({
        product_name: it.product_name,
        qty: Number(it.qty),
        unit_price: Number(it.unit_price),
        modifiers: it.modifiers ?? [],
      }));
    }

    await printBill({
      printers: printers as any,
      tableName: r.table_name ?? "?",
      items,
      total: Number(r.amount ?? 0),
      paymentMethod: "Online (Stripe)",
    });
  } catch (e) {
    console.warn("Auto-print Stripe-Bon fehlgeschlagen", e);
  }
}

const nav = [
  { to: "/", label: "Service", icon: Tablet },
  { to: "/pos", label: "Kasse", icon: ScanLine },
  { to: "/tables", label: "Tische", icon: Grid3x3 },
  { to: "/kitchen", label: "Küche/Bar", icon: ChefHat },
  { to: "/staff", label: "Team", icon: Users },
  { to: "/schichtplan", label: "Schichtplan", icon: CalendarDays },
  { to: "/mitarbeiter", label: "Lohn", icon: Banknote },
  { to: "/inventory", label: "Lager", icon: Package },
  { to: "/expenses", label: "Ausgaben", icon: Receipt },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/songs", label: "Songs", icon: Music },
  { to: "/payments", label: "Bezahlen", icon: Wallet },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const BARKEEPER_ALLOWED = new Set<string>([
  "/kitchen",
  "/mitarbeiter",
  "/inventory",
  "/expenses",
  "/songs",
  "/payments",
  "/settings",
]);

const SERVICE_ALLOWED = new Set<string>([
  "/",
  "/tables",
  "/mitarbeiter",
  "/inventory",
  "/songs",
  "/payments",
  "/settings",
]);

const roleLabel: Record<string, string> = {
  manager: "Manager",
  barkeeper: "Barkeeper",
  service: "Service",
  kueche: "Küche",
};

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { operator, setOperator, signOut } = useAuth();
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    const ch = supabase
      .channel(`song_requests_notify_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "song_requests" },
        (payload: any) => {
          const r = payload.new;
          // ignore historical/stale events that may fire on (re)subscribe
          if (new Date(r.created_at).getTime() < mountedAt.current - 5000) return;
          toast(`🎶 Neuer Song-Wunsch${r.table_name ? ` · Tisch ${r.table_name}` : ""}`, {
            description: `${r.title}${r.artist ? ` — ${r.artist}` : ""}`,
            position: "bottom-right",
            duration: 8000,
            action: {
              label: "Öffnen",
              onClick: () => {
                window.location.href = "/songs";
              },
            },
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    const beep = () => {
      try {
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
        if (!Ctx) return;
        const ctx = new Ctx();
        const play = (freq: number, start: number, dur = 0.18) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
          g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
          o.connect(g);
          g.connect(ctx.destination);
          o.start(ctx.currentTime + start);
          o.stop(ctx.currentTime + start + dur + 0.02);
        };
        play(880, 0);
        play(1175, 0.22);
        play(1568, 0.44, 0.28);
        setTimeout(() => ctx.close(), 1200);
      } catch {
        // ignore
      }
    };

    const ch = supabase
      .channel(`payment_requests_notify_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payment_requests" },
        (payload: any) => {
          const r = payload.new;
          if (new Date(r.created_at).getTime() < mountedAt.current - 5000) return;

          // Online-Zahlung (Stripe) erfolgreich → eigene Benachrichtigung + Auto-Bon
          if (r.status === "paid" && r.method === "stripe") {
            // freudiger Triplett-Klang
            try {
              const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
              if (Ctx) {
                const ctx = new Ctx();
                const playNote = (freq: number, start: number, dur = 0.22) => {
                  const o = ctx.createOscillator();
                  const g = ctx.createGain();
                  o.type = "sine";
                  o.frequency.value = freq;
                  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
                  g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
                  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
                  o.connect(g);
                  g.connect(ctx.destination);
                  o.start(ctx.currentTime + start);
                  o.stop(ctx.currentTime + start + dur + 0.02);
                };
                playNote(1046, 0);     // C6
                playNote(1318, 0.18);  // E6
                playNote(1568, 0.36, 0.4); // G6
                setTimeout(() => ctx.close(), 1400);
              }
            } catch { /* ignore */ }

            toast.success(`✅ Tisch ${r.table_name ?? "?"} hat online bezahlt`, {
              description: `Stripe · CHF ${Number(r.amount ?? 0).toFixed(2)} — Tisch ist frei`,
              position: "bottom-right",
              duration: 15000,
            });

            // Bon automatisch drucken (nur Desktop)
            void autoPrintPaidBill(r);
            return;
          }

          // Klassische Bezahl-Anfrage (Bar / EC) → bisheriges Verhalten
          const methodTxt =
            r.method === "cash" ? "Bar" : r.method === "card_terminal" ? "EC-Gerät" : "Online";
          beep();
          toast(`💰 Tisch ${r.table_name ?? "?"} möchte bezahlen`, {
            description: `${methodTxt} · CHF ${Number(r.amount ?? 0).toFixed(2)}`,
            position: "bottom-right",
            duration: 12000,
            action: {
              label: "Öffnen",
              onClick: () => {
                window.location.href = "/payments";
              },
            },
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    const ding = () => {
      try {
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
        if (!Ctx) return;
        const ctx = new Ctx();
        const play = (freq: number, start: number, dur = 0.2) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "triangle";
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
          g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
          o.connect(g);
          g.connect(ctx.destination);
          o.start(ctx.currentTime + start);
          o.stop(ctx.currentTime + start + dur + 0.02);
        };
        play(1320, 0, 0.25);
        play(990, 0.28, 0.3);
        play(1320, 0.6, 0.35);
        setTimeout(() => ctx.close(), 1400);
      } catch {
        // ignore
      }
    };

    const ch = supabase
      .channel(`service_calls_notify_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "service_calls" },
        (payload: any) => {
          const r = payload.new;
          if (new Date(r.created_at).getTime() < mountedAt.current - 5000) return;
          ding();
          toast(`🔔 Tisch ${r.table_name ?? "?"} ruft den Service`, {
            description: r.note ? `„${r.note}"` : "Bitte zum Tisch kommen",
            position: "bottom-right",
            duration: 15000,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);



  const visibleNav = operator?.role === "barkeeper"
    ? nav.filter((n) => BARKEEPER_ALLOWED.has(n.to))
    : operator?.role === "service"
    ? nav.filter((n) => SERVICE_ALLOWED.has(n.to))
    : nav;

  return (
    <SpotifyBarSpeakerProvider>
      <div className="min-h-screen w-full">
        <main className="min-h-screen w-full">{children}</main>
      </div>
    </SpotifyBarSpeakerProvider>
  );
}


export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-4 mb-6 md:mb-8">
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs md:text-sm text-muted-foreground mt-1 md:mt-1.5">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex gap-2 flex-wrap md:shrink-0 md:flex-nowrap md:items-end">{actions}</div>
      )}
    </div>
  );
}
