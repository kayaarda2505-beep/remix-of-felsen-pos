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
  
  CalendarDays,
  Music,
  Receipt,
  Wallet,
  Banknote,
  Sun,
  Moon,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { SaintsLogo } from "./SaintsLogo";
import { SpotifyPlayer } from "./SpotifyPlayer";
import { supabase } from "@/integrations/supabase/client";
import { getAgentPrinters, isDesktopApp, printReceipt, type PrinterConfig } from "@/lib/printer-bridge";
import { printBill, routeForCategory } from "@/lib/receipt";
import { SpotifyBarSpeakerProvider } from "@/components/SpotifyBarSpeaker";
import { UrgentAlertOverlay, pushUrgentAlert } from "@/components/UrgentAlert";
import { installAudioUnlock, getAudioContext } from "@/lib/audio-unlock";

async function autoPrintServiceCall(r: any) {
  if (!isDesktopApp()) return;
  try {
    const { data: printers } = await supabase
      .from("printers")
      .select("id, name, type, ip_address, port")
      .eq("active", true);

    let printer: PrinterConfig | undefined =
      printers?.find((p: any) => p.type === "bon") ??
      printers?.find((p: any) => p.type === "bar") ??
      printers?.[0];

    if (!printer) {
      const agentPrinters = await getAgentPrinters();
      const def = agentPrinters.printers?.find((p) => p.isDefault) ?? agentPrinters.printers?.[0];
      if (!def) {
        toast.error("Service-Bon nicht gedruckt", { description: "Kein Drucker im Print-Agent gefunden" });
        return;
      }
      printer = { id: "agent-default", name: def.name, type: "bon", ip_address: null, port: null };
    }

    const when = new Date(r.created_at ?? Date.now()).toLocaleTimeString("de-CH", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const result = await printReceipt(printer, {
      title: "SERVICE-RUF",
      lines: [
        { text: when, align: "center" },
        { separator: true },
        { text: `Tisch ${r.table_name ?? "?"}`, align: "center", size: "large", bold: true },
        { text: "braucht etwas", align: "center", size: "double-h" },
        { separator: true },
        ...(r.note
          ? [{ text: `Notiz: ${r.note}`, align: "center" as const }, { separator: true as const }]
          : []),
        { text: "Bitte zum Tisch gehen", align: "center" },
      ],
      cut: true,
    });
    if (!result.ok) {
      toast.error("Service-Bon nicht gedruckt", { description: result.error ?? "Druckfehler" });
    }
  } catch (e: any) {
    toast.error("Service-Bon nicht gedruckt", { description: e?.message ?? "Druckfehler" });
  }
}

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
  { to: "/musik", label: "Musik", icon: Music },
  { to: "/payments", label: "Bezahlen", icon: Wallet },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const BARKEEPER_ALLOWED = new Set<string>([
  "/kitchen",
  "/mitarbeiter",
  "/inventory",
  "/expenses",
  "/musik",
  "/musik",
  "/payments",
  "/settings",
]);

const SERVICE_ALLOWED = new Set<string>([
  "/",
  "/tables",
  "/mitarbeiter",
  "/inventory",
  "/musik",
  "/payments",
  "/settings",
]);

const KASSE_ALLOWED = new Set<string>([
  "/",
  "/pos",
  "/tables",
  "/inventory",
  "/reports",
  "/musik",
  "/payments",
  "/settings",
]);

const roleLabel: Record<string, string> = {
  manager: "Manager",
  barkeeper: "Barkeeper",
  service: "Service",
  kueche: "Küche",
  kasse: "Kasse",
};


export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { operator, setOperator } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const mountedAt = useRef(Date.now());
  const handledServiceCallIds = useRef<Set<string>>(new Set());
  const handledSongRequestIds = useRef<Set<string>>(new Set());
  const [openSongCount, setOpenSongCount] = useState(0);

  const songBadge = openSongCount > 99 ? "99+" : openSongCount > 0 ? String(openSongCount) : null;

  const refreshOpenSongCount = useCallback(async () => {
    const { count } = await supabase
      .from("song_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");
    setOpenSongCount(count ?? 0);
  }, []);

  const playSongAlert = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const play = (freq: number, start: number, dur = 0.22) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(ctx.currentTime + start);
        o.stop(ctx.currentTime + start + dur + 0.02);
      };
      play(659, 0);
      play(880, 0.24);
      play(1175, 0.48, 0.3);
      setTimeout(() => ctx.close(), 1200);
    } catch {
      // ignore
    }
  }, []);

  const playServiceDing = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
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
    } catch {
      // ignore
    }
  }, []);

  const handleSongRequest = useCallback((r: any) => {
    if (!r?.id || handledSongRequestIds.current.has(r.id)) return;
    handledSongRequestIds.current.add(r.id);
    playSongAlert();
    toast(`🎶 Neuer Song-Wunsch${r.table_name ? ` · Tisch ${r.table_name}` : ""}`, {
      description: `${r.title}${r.artist ? ` — ${r.artist}` : ""}`,
      position: "bottom-right",
      duration: 8000,
      action: {
        label: "Öffnen",
        onClick: () => {
          window.location.href = "/musik?tab=wuensche";
        },
      },
    });
  }, [playSongAlert]);

  useEffect(() => { installAudioUnlock(); }, []);

  useEffect(() => {
    void refreshOpenSongCount();
    const interval = window.setInterval(() => {
      void refreshOpenSongCount();
    }, 10000);
    return () => window.clearInterval(interval);
  }, [refreshOpenSongCount]);

  useEffect(() => {
    const ch = supabase
      .channel(`song_requests_notify_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "song_requests" },
        (payload: any) => {
          void refreshOpenSongCount();
          if (payload.eventType !== "INSERT") return;
          const r = payload.new;
          // ignore historical/stale events that may fire on (re)subscribe
          if (new Date(r.created_at).getTime() < mountedAt.current - 5000) return;
          handleSongRequest(r);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [handleSongRequest, refreshOpenSongCount]);

  useEffect(() => {
    const pollSongRequests = async () => {
      const { data } = await supabase
        .from("song_requests")
        .select("id, table_name, title, artist, created_at")
        .eq("status", "new")
        .gte("created_at", new Date(mountedAt.current - 5000).toISOString())
        .order("created_at", { ascending: true })
        .limit(20);
      for (const r of data ?? []) handleSongRequest(r);
    };

    const interval = window.setInterval(() => {
      void pollSongRequests();
    }, 4000);
    void pollSongRequests();
    return () => window.clearInterval(interval);
  }, [handleSongRequest]);

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

          // Klassische Bezahl-Anfrage (Bar / EC) → persistent Uber-style alert (nur Service)
          if (operatorRoleRef.current !== "service") return;
          const methodTxt =
            r.method === "cash" ? "Bar" : r.method === "card_terminal" ? "EC-Gerät" : "Online";
          beep();
          pushUrgentAlert({
            id: `payment-${r.id}`,
            kind: "payment",
            title: `Tisch ${r.table_name ?? "?"} möchte bezahlen`,
            description: `${methodTxt} · CHF ${Number(r.amount ?? 0).toFixed(2)}`,
            href: "/payments",
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);
  const operatorRole = operator?.role;
  const operatorRoleRef = useRef<string | undefined>(operatorRole);
  useEffect(() => { operatorRoleRef.current = operatorRole; }, [operatorRole]);
  const handleServiceCall = useCallback((r: any) => {
    if (!r?.id || handledServiceCallIds.current.has(r.id)) return;
    handledServiceCallIds.current.add(r.id);
    // Pop-up/Klingelton nur für Service & Manager
    if (operatorRole === "service") {
      playServiceDing();
      pushUrgentAlert({
        id: `service-${r.id}`,
        kind: "service",
        title: `Tisch ${r.table_name ?? "?"} ruft den Service`,
        description: r.note ? `„${r.note}"` : "Bitte zum Tisch kommen",
      });
    }
    void autoPrintServiceCall(r);
  }, [playServiceDing, operatorRole]);

  // Barkeeper / Küche Alert: neue Bestellung an passender Station
  const handledDrinkItemIds = useRef<Set<string>>(new Set());
  const handleStationOrderItem = useCallback(async (it: any) => {
    if (!it?.id || handledDrinkItemIds.current.has(it.id)) return;
    const station = routeForCategory(it.category); // "bar" | "kueche"
    if (operatorRole === "barkeeper" && station !== "bar") return;
    if (operatorRole === "kueche" && station !== "kueche") return;
    if (operatorRole !== "barkeeper" && operatorRole !== "kueche") return;
    handledDrinkItemIds.current.add(it.id);

    let tableName: string | null = null;
    if (it.order_id) {
      const { data: o } = await supabase
        .from("orders")
        .select("table_name")
        .eq("id", it.order_id)
        .maybeSingle();
      tableName = (o as any)?.table_name ?? null;
    }
    playServiceDing();
    const label = station === "bar" ? "Drink-Bestellung" : "Küchen-Bestellung";
    pushUrgentAlert({
      id: `order-${it.id}`,
      kind: "service",
      title: `Neue ${label}${tableName ? ` · Tisch ${tableName}` : ""}`,
      description: `${it.qty ?? 1}× ${it.product_name ?? "Artikel"}`,
      href: "/kitchen",
    });
  }, [operatorRole, playServiceDing]);

  useEffect(() => {
    if (operatorRole !== "barkeeper" && operatorRole !== "kueche") return;
    const ch = supabase
      .channel(`order_items_station_notify_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_items" },
        (payload: any) => {
          const it = payload.new;
          const ts = it.sent_at ?? it.created_at;
          if (ts && new Date(ts).getTime() < mountedAt.current - 5000) return;
          void handleStationOrderItem(it);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [handleStationOrderItem, operatorRole]);

  useEffect(() => {
    if (operatorRole !== "barkeeper" && operatorRole !== "kueche") return;
    const pollStationItems = async () => {
      const sinceIso = new Date(mountedAt.current - 5000).toISOString();
      const { data } = await supabase
        .from("order_items")
        .select("id, order_id, product_name, qty, category, sent_at")
        .gte("sent_at", sinceIso)
        .order("sent_at", { ascending: true })
        .limit(50);
      for (const it of data ?? []) await handleStationOrderItem(it);
    };
    const interval = window.setInterval(() => {
      void pollStationItems();
    }, 5000);
    void pollStationItems();
    return () => window.clearInterval(interval);
  }, [handleStationOrderItem, operatorRole]);

  useEffect(() => {
    const ch = supabase
      .channel(`service_calls_notify_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "service_calls" },
        (payload: any) => {
          const r = payload.new;
          if (new Date(r.created_at).getTime() < mountedAt.current - 5000) return;
          handleServiceCall(r);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [handleServiceCall]);

  useEffect(() => {
    const pollServiceCalls = async () => {
      const { data } = await supabase
        .from("service_calls")
        .select("id, table_name, note, created_at")
        .eq("status", "new")
        .gte("created_at", new Date(mountedAt.current - 5000).toISOString())
        .order("created_at", { ascending: true })
        .limit(20);
      for (const r of data ?? []) handleServiceCall(r);
    };

    const interval = window.setInterval(() => {
      void pollServiceCalls();
    }, 4000);
    void pollServiceCalls();
    return () => window.clearInterval(interval);
  }, [handleServiceCall]);



  const operatorRole = operator?.role as string | undefined;
  const visibleNav = operatorRole === "barkeeper"
    ? nav.filter((n) => BARKEEPER_ALLOWED.has(n.to))
    : operatorRole === "service"
    ? nav.filter((n) => SERVICE_ALLOWED.has(n.to))
    : operatorRole === "kasse"
    ? nav.filter((n) => KASSE_ALLOWED.has(n.to))
    : nav;



  return (
    <SpotifyBarSpeakerProvider>
    <UrgentAlertOverlay />
    <div className="h-screen flex w-full overflow-hidden">
      <aside className="hidden md:flex w-20 lg:w-60 flex-col p-3 lg:p-4 gap-1 border-r border-border/40 bg-sidebar/60 backdrop-blur-2xl overflow-y-auto">

        <div className="px-2 py-4 mb-2">
          <SaintsLogo size={36} withWordmark />
        </div>

        {visibleNav.map((item) => {
          const Icon = item.icon;
          const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all tap-highlight-none ${
                active
                  ? "bg-white/10 text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              <span className="hidden lg:block font-medium">{item.label}</span>
              {item.to === "/musik" && songBadge && (
                <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center leading-none">
                  {songBadge}
                </span>
              )}
              {active && (
                <span className={`hidden lg:block w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px] shadow-accent ${item.to === "/musik" && songBadge ? "" : "ml-auto"}`} />
              )}
            </Link>
          );
        })}

        <div className="mt-auto hidden lg:block space-y-2">
          {operator && <SpotifyPlayer />}
          {operator && (
            <div className="glass rounded-2xl p-3 text-xs">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-background shrink-0"
                  style={{ background: operator.color }}
                >
                  {operator.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{operator.name}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {roleLabel[operator.role] ?? operator.role}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setOperator(null)}
                  className="flex-1 rounded-lg bg-white/5 hover:bg-white/10 py-1.5 text-[10px] transition-colors"
                  title="Schicht beenden / Operator wechseln"
                >
                  Wechseln
                </button>
                <button
                  onClick={toggleTheme}
                  className="rounded-lg bg-white/5 hover:bg-white/10 p-1.5 transition-colors"
                  title={theme === "dark" ? "Helles Design" : "Dunkles Design"}
                  aria-label="Theme umschalten"
                >
                  {theme === "dark" ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 px-2 text-[10px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-success pulse-dot" />
            System online
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 min-h-0 overflow-auto">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 glass-strong border-t border-border/40">
        <div
          className="flex gap-1 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] overflow-x-auto snap-x"
          style={{ scrollbarWidth: "none" }}
        >
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl text-[10px] min-w-[64px] shrink-0 snap-start transition-colors ${
                  active ? "text-accent bg-white/5" : "text-muted-foreground"
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={1.75} />
                {item.to === "/musik" && songBadge && (
                  <span className="absolute mt-[-1.625rem] ml-7 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center leading-none">
                    {songBadge}
                  </span>
                )}
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
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
