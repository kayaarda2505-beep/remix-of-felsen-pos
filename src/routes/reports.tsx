import { createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Receipt, ShoppingCart, Wallet, CreditCard, Printer, Banknote, Coins, AlertTriangle, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { printDailyReport, printBill } from "@/lib/receipt";
import { isDesktopApp, type PrinterConfig } from "@/lib/printer-bridge";



export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — SAINTS POS" }] }),
  component: Reports,
});

// Standard Schweizer Gebühren-Defaults (anpassbar in payment_methods.fee_pct)
const DEFAULT_FEES: Record<string, { pct: number; fixed: number; label: string }> = {
  card_terminal: { pct: 1.3, fixed: 0, label: "Worldline" },
  stripe:        { pct: 2.9, fixed: 0.30, label: "Stripe" },
  twint:         { pct: 1.3, fixed: 0, label: "TWINT" },
  apple_pay:     { pct: 2.9, fixed: 0.30, label: "Apple Pay" },
  google_pay:    { pct: 2.9, fixed: 0.30, label: "Google Pay" },
};

function fmtISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d: Date) { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); x.setHours(0,0,0,0); return x; }
function startOfMonth(d: Date) { const x = new Date(d.getFullYear(), d.getMonth(), 1); return x; }
function startOfYear(d: Date) { return new Date(d.getFullYear(), 0, 1); }

type RangePreset = "today" | "week" | "month" | "year" | "custom";

function Reports() {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [preset, setPreset] = useState<RangePreset>("today");
  const [from, setFrom] = useState<Date>(today);
  const [to, setTo] = useState<Date>(today);
  const [isRangePending, startRangeTransition] = useTransition();
  const deferredFrom = useDeferredValue(from);
  const deferredTo = useDeferredValue(to);
  const queryClient = useQueryClient();
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Rolle des aktuellen Users (für Löschen-Berechtigung)
  const { data: canDelete = false } = useQuery({
    queryKey: ["current_user_role_can_delete"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = (data ?? []).map((r: any) => r.role);
      return roles.includes("admin") || roles.includes("manager");
    },
  });

  const applyPreset = (p: RangePreset) => {
    const now = new Date(); now.setHours(0,0,0,0);
    const nextFrom = p === "today" ? now : p === "week" ? startOfWeek(now) : p === "month" ? startOfMonth(now) : startOfYear(now);
    startRangeTransition(() => {
      setPreset(p);
      setFrom(nextFrom);
      setTo(now);
    });
  };

  const isoFrom = fmtISO(deferredFrom);
  const isoToNext = fmtISO(addDays(deferredTo, 1));
  const rangeDays = Math.max(1, Math.round((deferredTo.getTime() - deferredFrom.getTime()) / 86400000) + 1);
  // Bei langen Zeiträumen aggregiert die Datenbank — sonst friert der Browser ein.
  const useAggregates = rangeDays > 14;
  const singleDay = isoFrom === fmtISO(deferredTo);
  const compactTrend = useAggregates && rangeDays > 62;

  // Rohe Orders nur bei kurzen Zeiträumen
  const { data: orders = [] } = useQuery({
    queryKey: ["orders_range", isoFrom, isoToNext, useAggregates],
    enabled: !useAggregates,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, status, guests, created_at, closed_at")
        .gte("created_at", `${isoFrom}T00:00:00`)
        .lt("created_at", `${isoToNext}T00:00:00`)
        .limit(10000);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Aggregierter KPI-Summen-Server-Aufruf bei langen Zeiträumen
  const { data: ordersSummary } = useQuery({
    queryKey: ["report_orders_summary", isoFrom, isoToNext, useAggregates],
    enabled: useAggregates,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_orders_summary", {
        p_from: `${isoFrom}T00:00:00`,
        p_to: `${isoToNext}T00:00:00`,
      });
      if (error) throw error;
      const row = (data ?? [])[0] as { revenue: number; order_count: number; closed_count: number } | undefined;
      return row ?? { revenue: 0, order_count: 0, closed_count: 0 };
    },
  });

  // Tagesumsätze (für Trend-Chart) bei mehrtägigem Bereich
  const { data: dailyAgg = [] } = useQuery({
    queryKey: ["report_daily_totals", isoFrom, isoToNext, useAggregates, singleDay],
    enabled: useAggregates && !singleDay,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_daily_totals", {
        p_from: `${isoFrom}T00:00:00`,
        p_to: `${isoToNext}T00:00:00`,
      });
      if (error) throw error;
      return (data ?? []) as Array<{ day: string; total: number }>;
    },
  });

  // Rohe Items nur bei kurzen Zeiträumen laden
  const { data: items = [] } = useQuery({
    queryKey: ["items_range_v2", isoFrom, isoToNext, useAggregates],
    enabled: !useAggregates,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("order_id, product_name, category, qty, unit_price, note, sent_at")
        .gte("sent_at", `${isoFrom}T00:00:00`)
        .lt("sent_at", `${isoToNext}T00:00:00`)
        .limit(20000);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Tisch-Namen für Belegkopf beim Nachdruck
  const { data: tables = [] } = useQuery<Array<{ id: string; name: string | null }>>({
    queryKey: ["dining_tables_names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dining_tables").select("id, name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string | null }>;
    },
  });

  // Server-Aggregation bei langen Zeiträumen
  const { data: categoryAgg = [] } = useQuery({
    queryKey: ["report_category_totals", isoFrom, isoToNext, useAggregates],
    enabled: useAggregates,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_category_totals", {
        p_from: `${isoFrom}T00:00:00`,
        p_to: `${isoToNext}T00:00:00`,
      });
      if (error) throw error;
      return (data ?? []) as Array<{ category: string; total: number }>;
    },
  });

  const { data: hourlyAgg = [] } = useQuery({
    queryKey: ["report_hourly_totals", isoFrom, isoToNext, useAggregates, singleDay],
    enabled: useAggregates && singleDay,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_hourly_totals", {
        p_from: `${isoFrom}T00:00:00`,
        p_to: `${isoToNext}T00:00:00`,
      });
      if (error) throw error;
      return (data ?? []) as Array<{ hour: number; total: number }>;
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses_range", isoFrom, fmtISO(deferredTo), useAggregates],
    enabled: !useAggregates,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, category, vendor, description, payment_method, expense_date")
        .gte("expense_date", isoFrom)
        .lte("expense_date", fmtISO(deferredTo))
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: expenseSummary } = useQuery({
    queryKey: ["report_expenses_summary", isoFrom, fmtISO(deferredTo), useAggregates],
    enabled: useAggregates,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_expenses_summary", {
        p_from: isoFrom,
        p_to: fmtISO(deferredTo),
      });
      if (error) throw error;
      const row = (data ?? [])[0] as { total: number; expense_count: number } | undefined;
      return row ?? { total: 0, expense_count: 0 };
    },
  });

  const { data: expenseCategoryAgg = [] } = useQuery({
    queryKey: ["report_expenses_by_category", isoFrom, fmtISO(deferredTo), useAggregates],
    enabled: useAggregates,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_expenses_by_category", {
        p_from: isoFrom,
        p_to: fmtISO(deferredTo),
      });
      if (error) throw error;
      return (data ?? []) as Array<{ category: string; total: number }>;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments_range_v3", isoFrom, isoToNext],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_requests")
        .select("id, order_id, amount, tip, method, status, note, created_at, handled_at")
        .eq("status", "paid")
        .gte("created_at", `${isoFrom}T00:00:00`)
        .lt("created_at", `${isoToNext}T00:00:00`)
        .limit(10000);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; order_id: string | null; amount: number; tip: number | null; method: string; status: string; note: string | null; created_at: string; handled_at: string | null }>;
    },
  });


  const { data: paymentMethodAgg = [] } = useQuery({
    queryKey: ["report_payment_method_totals", isoFrom, isoToNext, useAggregates],
    enabled: useAggregates,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_payment_method_totals", {
        p_from: `${isoFrom}T00:00:00`,
        p_to: `${isoToNext}T00:00:00`,
      });
      if (error) throw error;
      return (data ?? []) as Array<{ method: string; payment_count: number; volume: number }>;
    },
  });

  const { data: feeOverrides = [] } = useQuery({
    queryKey: ["payment_methods_fees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_methods").select("type, fee_pct");
      if (error) throw error;
      return data ?? [];
    },
  });
  const feeMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of feeOverrides) if (f.type && Number(f.fee_pct) > 0) m.set(f.type, Number(f.fee_pct));
    return m;
  }, [feeOverrides]);

  // Gebühren pro Methode berechnen (immer aus payment_requests)
  const feesByMethod = useMemo(() => {
    const m = new Map<string, { sum: number; count: number; volume: number; label: string }>();
    for (const p of payments) {
      const def = DEFAULT_FEES[p.method as string];
      if (!def) continue; // Bar/Cash → keine Gebühren
      const pct = feeMap.get(p.method as string) ?? def.pct;
      const fee = (Number(p.amount) * pct) / 100 + def.fixed;
      const cur = m.get(p.method as string) ?? { sum: 0, count: 0, volume: 0, label: def.label };
      cur.sum += fee; cur.count += 1; cur.volume += Number(p.amount);
      m.set(p.method as string, cur);
    }
    return [...m.entries()].map(([method, v]) => ({ method, ...v }));
  }, [payments, feeMap]);
  const feeTotal = feesByMethod.reduce((s, f) => s + f.sum, 0);

  // Umsatz nach Zahlungsart (aus payment_requests + paid orders ohne payment_requests → Bar)
  const paymentBreakdown = useMemo(() => {
    let cash = 0, card = 0, twint = 0, other = 0, tips = 0;
    let cashCount = 0, cardCount = 0;
    for (const p of payments) {
      const amt = Number(p.amount ?? 0);
      const tip = Number(p.tip ?? 0);
      tips += tip;
      if (p.method === "cash") { cash += amt; cashCount++; }
      else if (p.method === "card_terminal" || p.method === "stripe" || p.method === "apple_pay" || p.method === "google_pay") { card += amt; cardCount++; }
      else if (p.method === "twint") { twint += amt; }
      else { other += amt; }
    }
    const paidOrderIds = new Set((payments as any[]).map((p) => p.order_id).filter(Boolean));
    for (const o of orders as any[]) {
      if (o.status === "paid" && !paidOrderIds.has(o.id)) {
        cash += Number(o.total ?? 0);
        cashCount++;
      }
    }
    return { cash, card, twint, other, tips, cashCount, cardCount };
  }, [payments, orders]);


  // Bar-Ausgaben (was aus der Kasse rausging)
  const cashExpenseTotal = useMemo(
    () => expenses
      .filter((e) => (e.payment_method ?? "").toLowerCase() === "cash" || (e.payment_method ?? "").toLowerCase() === "bar")
      .reduce((s, e) => s + Number(e.amount ?? 0), 0),
    [expenses],
  );

  // Kassen-Zählung (nur bei Einzeltag sinnvoll)
  const { data: cashCountRow } = useQuery({
    queryKey: ["cash_counts", isoFrom, singleDay],
    enabled: singleDay,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cash_counts")
        .select("id, counted_amount, expected_amount, note, counted_by, created_at")
        .eq("count_date", isoFrom)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; counted_amount: number; expected_amount: number; note: string | null; counted_by: string | null; created_at: string } | null;
    },
  });

  // Kassen-Bewegungen (Einlagen/Entnahmen)
  // Kumulativ bis Ende gewählter Tag → für Soll-Berechnung
  const endOfDay = `${fmtISO(deferredTo)}T23:59:59.999`;
  const { data: cashMovementsCum = [] } = useQuery({
    queryKey: ["cash_movements_cum", endOfDay],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cash_movements")
        .select("amount")
        .lte("occurred_at", endOfDay);
      if (error) throw error;
      return (data ?? []) as Array<{ amount: number }>;
    },
  });

  const movementsCumTotal = useMemo(
    () => cashMovementsCum.reduce((s, m) => s + Number(m.amount ?? 0), 0),
    [cashMovementsCum],
  );

  // Bewegungen des gewählten Tages (für Anzeige)
  const { data: cashMovementsDay = [] } = useQuery({
    queryKey: ["cash_movements_day", isoFrom, isoToNext, singleDay],
    enabled: singleDay,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cash_movements")
        .select("id, occurred_at, amount, kind, note")
        .gte("occurred_at", `${isoFrom}T00:00:00`)
        .lt("occurred_at", `${isoToNext}T00:00:00`)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; occurred_at: string; amount: number; kind: string; note: string | null }>;
    },
  });

  // Kumulative Bar-Einnahmen und Bar-Ausgaben bis Ende Tag
  const { data: cashCumRow } = useQuery({
    queryKey: ["cash_cum", endOfDay],
    queryFn: async () => {
      const [{ data: pays, error: pErr }, { data: exps, error: eErr }] = await Promise.all([
        supabase
          .from("payment_requests")
          .select("amount")
          .eq("status", "paid")
          .eq("method", "cash")
          .lte("created_at", endOfDay)
          .limit(50000),
        supabase
          .from("expenses")
          .select("amount")
          .lte("expense_date", fmtISO(deferredTo))
          .in("payment_method", ["cash", "bar", "Bar", "Cash"])
          .limit(50000),
      ]);
      if (pErr) throw pErr;
      if (eErr) throw eErr;
      const cashIn = (pays ?? []).reduce((s, p: any) => s + Number(p.amount ?? 0), 0);
      const cashOut = (exps ?? []).reduce((s, e: any) => s + Number(e.amount ?? 0), 0);
      return { cashIn, cashOut };
    },
  });




  // Umsatz gesamt = Karte + TWINT + Bar + Sonstige (Bar enthält bereits paid orders ohne payment_requests)
  const revenue = paymentBreakdown.card + paymentBreakdown.twint + paymentBreakdown.cash + paymentBreakdown.other;



  const expenseTotal = useAggregates
    ? Number(expenseSummary?.total ?? 0)
    : expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const expenseCount = useAggregates ? Number(expenseSummary?.expense_count ?? 0) : expenses.length;
  const totalCosts = expenseTotal + feeTotal;
  const profit = revenue - totalCosts;
  const closedCount = useAggregates
    ? Number(ordersSummary?.closed_count ?? 0)
    : orders.filter((o) => o.status === "paid").length;
  const avgTicket = closedCount ? revenue / closedCount : 0;

  const byCategory = useMemo(() => {
    if (useAggregates) {
      return categoryAgg
        .map((c) => [c.category, Number(c.total)] as [string, number])
        .sort((a, b) => b[1] - a[1]);
    }
    const m = new Map<string, number>();
    for (const i of items) {
      const v = Number(i.unit_price ?? 0) * Number(i.qty ?? 0);
      const c = i.category ?? "Sonstiges";
      m.set(c, (m.get(c) ?? 0) + v);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items, categoryAgg, useAggregates]);

  const expByCat = useMemo(() => {
    if (useAggregates) {
      const m = new Map<string, number>();
      for (const e of expenseCategoryAgg) m.set(e.category, Number(e.total ?? 0));
      for (const f of feesByMethod) m.set(`Gebühren ${f.label}`, (m.get(`Gebühren ${f.label}`) ?? 0) + f.sum);
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    }
    const m = new Map<string, number>();
    for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount));
    for (const f of feesByMethod) m.set(`Gebühren ${f.label}`, (m.get(`Gebühren ${f.label}`) ?? 0) + f.sum);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses, expenseCategoryAgg, feesByMethod, useAggregates]);

  // Umsatz pro Tag (bei mehrtägigem Bereich) oder pro Stunde (bei einem Tag)
  const trend = useMemo(() => {
    if (singleDay) {
      const arr = new Array(24).fill(0);
      if (useAggregates) {
        for (const h of hourlyAgg) arr[h.hour] = Number(h.total);
      } else {
        for (const i of items) {
          const h = new Date(i.sent_at as string).getHours();
          arr[h] += Number(i.unit_price ?? 0) * Number(i.qty ?? 0);
        }
      }
      return arr.map((v, h) => ({ label: `${h}`, value: v }));
    }
    const bucket = compactTrend ? 7 : 1;
    const days: { label: string; value: number; keys: string[] }[] = [];
    for (let d = new Date(deferredFrom), i = 0; d <= deferredTo; d = addDays(d, bucket), i += bucket) {
      const end = addDays(d, bucket - 1);
      const clampedEnd = end > deferredTo ? deferredTo : end;
      const keys: string[] = [];
      for (let k = new Date(d); k <= clampedEnd; k = addDays(k, 1)) keys.push(fmtISO(k));
      days.push({
        keys,
        label: compactTrend
          ? `KW ${Math.ceil((i + 1) / 7)}`
          : d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" }),
        value: 0,
      });
    }
    const map = new Map(days.flatMap((d, i) => d.keys.map((key) => [key, i] as const)));
    if (useAggregates) {
      for (const row of dailyAgg) {
        const idx = map.get(row.day);
        if (idx !== undefined) days[idx].value = Number(row.total);
      }
    } else {
      for (const o of orders) {
        const k = fmtISO(new Date(o.created_at as string));
        const idx = map.get(k);
        if (idx !== undefined) days[idx].value += Number(o.total ?? 0);
      }
    }
    return days;
  }, [items, orders, deferredFrom, deferredTo, singleDay, useAggregates, hourlyAgg, dailyAgg, compactTrend]);
  const trendMax = Math.max(1, ...trend.map(t => t.value));

  const rangeLabel = singleDay
    ? deferredFrom.toLocaleDateString("de-CH", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    : `${deferredFrom.toLocaleDateString("de-CH")} – ${deferredTo.toLocaleDateString("de-CH")}`;

  // Drucker für Tagesabschluss
  const { data: printers = [] } = useQuery({
    queryKey: ["printers", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("printers")
        .select("id, name, type, ip_address, port")
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [printing, setPrinting] = useState(false);
  const printReport = async () => {
    if (!isDesktopApp()) {
      toast.error("Kein Print-Agent konfiguriert – siehe Einstellungen › Drucker");
      return;
    }
    setPrinting(true);
    const presetLabel =
      preset === "today" ? "Heute" :
      preset === "week" ? "Woche" :
      preset === "month" ? "Monat" :
      preset === "year" ? "Jahr" : "Zeitraum";
    const err = await printDailyReport({
      printers,
      data: {
        rangeLabel: `${presetLabel} · ${rangeLabel}`,
        revenue,
        expenseTotal,
        feeTotal,
        profit,
        avgTicket,
        closedOrdersCount: closedCount,
        byCategory,
        feesByMethod: feesByMethod.map((f) => ({
          label: f.label, sum: f.sum, count: f.count, volume: f.volume,
        })),
        expensesByCategory: [...new Map(
          expenses.reduce<Array<[string, number]>>((acc, e) => {
            const cur = acc.find((x) => x[0] === e.category);
            if (cur) cur[1] += Number(e.amount);
            else acc.push([e.category, Number(e.amount)]);
            return acc;
          }, []),
        )].sort((a, b) => b[1] - a[1]),
      },
    });
    setPrinting(false);
    if (err) toast.error(`Druck: ${err}`);
    else toast.success("Tagesabschluss gedruckt");
  };

  return (
    <div className="p-4 lg:p-10 pb-28 md:pb-10 max-w-[1600px] mx-auto">
      <PageHeader
        title="Reports"
        subtitle="Umsatz · Ausgaben · Gebühren · Gewinn"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 glass rounded-xl p-1">
              {(["today","week","month","year"] as RangePreset[]).map(p => (
                <button key={p} onClick={() => applyPreset(p)} disabled={isRangePending}
                  className={`px-3 h-9 rounded-lg text-xs transition-colors disabled:opacity-60 ${preset===p ? "bg-accent/20 text-accent" : "hover:bg-white/10"}`}>
                  {p==="today"?"Heute":p==="week"?"Woche":p==="month"?"Monat":"Jahr"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 glass rounded-xl p-1">
              <input type="date" value={fmtISO(from)} onChange={(e) => { setPreset("custom"); setFrom(new Date(e.target.value + "T00:00:00")); }}
                className="bg-transparent text-xs px-2 h-9 outline-none tabular-nums" />
              <span className="text-xs text-muted-foreground">–</span>
              <input type="date" value={fmtISO(to)} onChange={(e) => { setPreset("custom"); setTo(new Date(e.target.value + "T00:00:00")); }}
                className="bg-transparent text-xs px-2 h-9 outline-none tabular-nums" />
            </div>
            <button
              onClick={printReport}
              disabled={printing}
              className="glass rounded-xl px-3 h-9 text-xs flex items-center gap-2 hover:border-accent/40 disabled:opacity-50"
              title="Tagesabschluss als Bon drucken"
            >
              <Printer className="w-3.5 h-3.5" />
              {printing ? "Drucke…" : "Tagesabschluss drucken"}
            </button>
          </div>
        }
      />


      <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm capitalize">
        <span className="font-medium">{rangeLabel}</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Kpi label="Umsatz gesamt" value={revenue} icon={<TrendingUp className="w-4 h-4" />} accent />
        <Kpi label="Umsatz Karte" value={paymentBreakdown.card + paymentBreakdown.twint} icon={<CreditCard className="w-4 h-4" />} sub={`${paymentBreakdown.cardCount} Karte${paymentBreakdown.twint > 0 ? ` · TWINT ${paymentBreakdown.twint.toFixed(2)}` : ""}`} />
        <Kpi label="Umsatz Bar" value={paymentBreakdown.cash} icon={<Banknote className="w-4 h-4" />} sub={`${paymentBreakdown.cashCount} Bar-Zahlungen`} />
        <Kpi label="Trinkgeld" value={paymentBreakdown.tips} icon={<Coins className="w-4 h-4 text-success" />} highlight={paymentBreakdown.tips > 0 ? "positive" : undefined} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi label="Ausgaben" value={expenseTotal} icon={<TrendingDown className="w-4 h-4 text-destructive" />} sub={`${expenseCount} Belege`} />
        <Kpi label="Gebühren" value={feeTotal} icon={<CreditCard className="w-4 h-4 text-destructive/80" />} sub={`${feesByMethod.reduce((s, f) => s + f.count, 0)} Online-Zahlungen`} />
        <Kpi label="Gewinn" value={profit} icon={<Wallet className="w-4 h-4" />} highlight={profit >= 0 ? "positive" : "negative"} />
        <Kpi label="Ø Bon" value={avgTicket} icon={<ShoppingCart className="w-4 h-4" />} sub={`${closedCount} Abschlüsse`} />
      </div>

      {/* Kassenbestand */}
      <CashTillPanel
        singleDay={singleDay}
        isoDate={isoFrom}
        cashRevenue={paymentBreakdown.cash}
        cashExpenses={cashExpenseTotal}
        tips={paymentBreakdown.tips}
        cashCountRow={cashCountRow}
        movementsTotal={movementsCumTotal}
        cashInCum={Number(cashCumRow?.cashIn ?? 0)}
        cashOutCum={Number(cashCumRow?.cashOut ?? 0)}
        movementsDay={cashMovementsDay}
      />



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Trend chart */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-4">
            {singleDay ? "Umsatz pro Stunde" : "Umsatz pro Tag"}
          </div>
          {revenue === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">Keine Bestellungen</div>
          ) : (
            <div className="flex items-end gap-1 h-40">
              {trend.map((t, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group" title={`${t.label} — ${t.value.toFixed(2)} CHF`}>
                  <div className="w-full bg-gradient-to-t from-accent/40 to-accent/80 rounded-t transition-all group-hover:from-accent/60 group-hover:to-accent"
                    style={{ height: `${(t.value / trendMax) * 100}%`, minHeight: t.value > 0 ? 2 : 0 }} />
                  <div className="text-[9px] text-muted-foreground tabular-nums">
                    {singleDay ? (Number(t.label) % 3 === 0 ? t.label : "") : (i % Math.max(1, Math.floor(trend.length / 8)) === 0 ? t.label : "")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Revenue by category */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-3xl p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-4">Umsatz nach Kategorie</div>
          {byCategory.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">—</div>
          ) : (
            <div className="space-y-2">
              {byCategory.map(([cat, sum]) => {
                const pct = (sum / revenue) * 100;
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{cat}</span>
                      <span className="tabular-nums text-muted-foreground">{sum.toFixed(2)} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-accent/50 to-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Gebühren-Aufschlüsselung */}
      {feesByMethod.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="glass rounded-3xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Zahlungsgebühren</div>
              <div className="text-xl font-semibold tabular-nums mt-0.5 text-destructive/90">−{feeTotal.toFixed(2)} CHF</div>
            </div>
            <div className="text-xs text-muted-foreground">Schweizer Standard-Sätze</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {feesByMethod.map(f => {
              const def = DEFAULT_FEES[f.method];
              const pct = feeMap.get(f.method) ?? def.pct;
              return (
                <div key={f.method} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{f.label}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {f.count} Zahlungen · {f.volume.toFixed(2)} CHF Volumen · {pct.toFixed(2)}%{def.fixed > 0 ? ` + ${def.fixed.toFixed(2)} CHF` : ""}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-destructive/90">−{f.sum.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Einzelne Umsätze (Bestellungen) */}
      {!useAggregates && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }} className="glass rounded-3xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Einzelne Umsätze</div>
              <div className="text-xl font-semibold tabular-nums mt-0.5">{orders.length} Bestellungen</div>
            </div>
            <div className="text-xs text-muted-foreground">{revenue.toFixed(2)} CHF gesamt</div>
          </div>
          {orders.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6 flex flex-col items-center gap-2">
              <Receipt className="w-8 h-8 opacity-40" />
              Keine Bestellungen
            </div>
          ) : (
            <div className="divide-y divide-border/30 -mx-2 max-h-[560px] overflow-y-auto">
              {[...orders]
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((o: any) => {
                  const dt = new Date(o.created_at);
                  const time = dt.toLocaleString("de-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
                  const orderItems = (items as any[]).filter((it) => it.order_id === o.id);
                  const orderPays = (payments as any[]).filter((p) => p.order_id === o.id);
                  const tipSum = orderPays.reduce((s, p) => s + Number(p.tip || 0), 0);
                  const methodLabel = (m: string) => m === "cash" ? "Bar" : m === "card_terminal" ? "Karte" : m === "twint" ? "TWINT" : m === "stripe" ? "Stripe" : m;
                  const methods = orderPays.length ? [...new Set(orderPays.map(p => methodLabel(p.method)))].join(", ") : "—";
                  const isOpen = expandedOrder === o.id;
                  return (
                    <div key={o.id} className="px-2">
                      <button
                        type="button"
                        onClick={() => setExpandedOrder(isOpen ? null : o.id)}
                        className="w-full flex items-center gap-3 py-2 text-left hover:bg-white/5 rounded-lg transition"
                      >
                        <div className={`w-2 h-2 rounded-full ${o.status === "paid" ? "bg-success" : "bg-accent/60"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">#{String(o.id).slice(0, 8)} · {time}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {o.status === "paid" ? "Bezahlt" : o.status}{o.guests ? ` · ${o.guests} Gäste` : ""} · {methods}{tipSum > 0 ? ` · TG ${tipSum.toFixed(2)}` : ""}
                          </div>
                        </div>
                        <div className="text-sm font-semibold tabular-nums">{Number(o.total ?? 0).toFixed(2)} CHF</div>
                      </button>
                      {isOpen && (
                        <div className="ml-5 mb-3 mt-1 p-3 rounded-xl bg-white/5 space-y-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Positionen</div>
                            {orderItems.length === 0 ? (
                              <div className="text-xs text-muted-foreground">Keine Positionen</div>
                            ) : (
                              <div className="space-y-1">
                                {orderItems.map((it, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs">
                                    <div className="min-w-0 truncate">
                                      <span className="tabular-nums text-muted-foreground mr-2">{it.qty}×</span>
                                      {it.product_name}
                                      {it.note ? <span className="text-muted-foreground"> · {it.note}</span> : null}
                                    </div>
                                    <div className="tabular-nums">{(Number(it.unit_price) * Number(it.qty)).toFixed(2)}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Zahlungen</div>
                            {orderPays.length === 0 ? (
                              <div className="text-xs text-muted-foreground">Keine Zahlung erfasst</div>
                            ) : (
                              <div className="space-y-1">
                                {orderPays.map((p) => (
                                  <div key={p.id} className="flex items-center justify-between text-xs">
                                    <div className="truncate">
                                      {methodLabel(p.method)}
                                      {p.note ? <span className="text-muted-foreground"> · {p.note}</span> : null}
                                      {Number(p.tip || 0) > 0 ? <span className="text-muted-foreground"> · TG {Number(p.tip).toFixed(2)}</span> : null}
                                    </div>
                                    <div className="tabular-nums">{Number(p.amount).toFixed(2)}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="pt-1 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!isDesktopApp()) {
                                  toast.error("Kein Print-Agent aktiv – Beleg kann nicht gedruckt werden");
                                  return;
                                }
                                if (orderItems.length === 0) {
                                  toast.error("Keine Positionen zum Drucken");
                                  return;
                                }
                                const tbl = tables.find((t) => t.id === o.table_id);
                                const tableName = tbl?.name || (o.table_id ? "Tisch" : "Walk-in");
                                const paidSum = orderPays.reduce((s, p) => s + Number(p.amount || 0), 0);
                                const subtotal = orderItems.reduce((s, it) => s + Number(it.unit_price) * Number(it.qty), 0);
                                const primaryMethod = orderPays[0]?.method ?? null;
                                const err = await printBill({
                                  printers: printers as PrinterConfig[],
                                  tableName,
                                  items: orderItems.map((it) => ({
                                    product_name: it.product_name,
                                    qty: Number(it.qty),
                                    unit_price: Number(it.unit_price),
                                    note: it.note ?? null,
                                  })),
                                  subtotal,
                                  total: Number(o.total ?? paidSum),
                                  tip: tipSum,
                                  interim: false,
                                  paymentMethod: primaryMethod,
                                });
                                if (err) toast.error(`Druck: ${err}`);
                                else toast.success("Beleg gedruckt");
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/15 border border-white/15 transition inline-flex items-center gap-1.5"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Beleg nachdrucken
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!confirm(`Bestellung #${String(o.id).slice(0,8)} wirklich löschen? Zahlungen werden ebenfalls entfernt.`)) return;
                                  const { error: pErr } = await supabase.from("payment_requests").delete().eq("order_id", o.id);
                                  if (pErr) { toast.error("Zahlungen löschen fehlgeschlagen: " + pErr.message); return; }
                                  const { error: oErr } = await supabase.from("orders").delete().eq("id", o.id);
                                  if (oErr) { toast.error("Bestellung löschen fehlgeschlagen: " + oErr.message); return; }
                                  toast.success("Bestellung gelöscht");
                                  setExpandedOrder(null);
                                  queryClient.invalidateQueries();
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs bg-destructive/20 hover:bg-destructive/30 text-destructive border border-destructive/30 transition"
                              >
                                Bestellung löschen
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </motion.div>
      )}

      {/* Expenses section */}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-3xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ausgaben</div>
            <div className="text-xl font-semibold tabular-nums mt-0.5">{expenseTotal.toFixed(2)} CHF</div>
          </div>
              <div className="text-xs text-muted-foreground">{expenseCount} Belege</div>
        </div>

        {expenseCount === 0 && feesByMethod.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-6 flex flex-col items-center gap-2">
            <Receipt className="w-8 h-8 opacity-40" />
            Keine Ausgaben erfasst
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {expByCat.map(([cat, sum]) => (
                <div key={cat} className="px-3 py-1.5 rounded-lg bg-white/5 text-xs flex items-center gap-2">
                  <span>{cat}</span>
                  <span className="tabular-nums font-semibold text-destructive/90">−{sum.toFixed(2)}</span>
                </div>
              ))}
            </div>
            {!useAggregates && expenses.length > 0 && (
              <div className="divide-y divide-border/30 -mx-2">
                {expenses.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-2">
                    <div className="w-2 h-2 rounded-full bg-destructive/60" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{e.vendor || e.description || e.category}</div>
                      <div className="text-[10px] text-muted-foreground">{e.category}{e.payment_method ? ` · ${e.payment_method}` : ""}{e.expense_date ? ` · ${e.expense_date}` : ""}</div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-destructive/90">−{Number(e.amount).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

function Kpi({ label, value, icon, sub, accent, highlight }: {
  label: string; value: number; icon?: React.ReactNode; sub?: string;
  accent?: boolean; highlight?: "positive" | "negative";
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        {icon}
      </div>
      <div className={`text-2xl font-semibold tabular-nums mt-1 ${accent ? "text-accent" : ""} ${highlight === "negative" ? "text-destructive" : ""} ${highlight === "positive" ? "text-success" : ""}`}>
        {value.toFixed(2)} <span className="text-xs text-muted-foreground font-normal">CHF</span>
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </motion.div>
  );
}

function CashTillPanel({
  singleDay, isoDate, cashRevenue, cashExpenses, tips, cashCountRow,
  movementsTotal, cashInCum, cashOutCum, movementsDay,
}: {
  singleDay: boolean;
  isoDate: string;
  cashRevenue: number;
  cashExpenses: number;
  tips: number;
  cashCountRow: { id: string; counted_amount: number; expected_amount: number; note: string | null; counted_by: string | null; created_at: string } | null | undefined;
  movementsTotal: number;
  cashInCum: number;
  cashOutCum: number;
  movementsDay: Array<{ id: string; occurred_at: string; amount: number; kind: string; note: string | null }>;
}) {
  const qc = useQueryClient();
  // Soll = kumulative Bar-Einnahmen − kumulative Bar-Ausgaben + kumulative Einlagen/Entnahmen
  const expected = +(cashInCum - cashOutCum + movementsTotal).toFixed(2);
  const [counted, setCounted] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Bewegung hinzufügen
  const [movAmount, setMovAmount] = useState<string>("");
  const [movNote, setMovNote] = useState<string>("");
  const [movSaving, setMovSaving] = useState(false);

  useEffect(() => {
    if (cashCountRow) {
      setCounted(String(cashCountRow.counted_amount ?? ""));
      setNote(cashCountRow.note ?? "");
    } else {
      setCounted("");
      setNote("");
    }
  }, [cashCountRow?.id, isoDate]);

  const countedNum = Number(counted.replace(",", ".")) || 0;
  const diff = +(countedNum - expected).toFixed(2);
  const hasCount = counted !== "" && !isNaN(Number(counted.replace(",", ".")));

  const save = async () => {
    if (!singleDay) return;
    setSaving(true);
    const payload = {
      count_date: isoDate,
      counted_amount: countedNum,
      expected_amount: expected,
      note: note || null,
    };
    const { error } = await (supabase as any).from("cash_counts").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Kassenzählung gespeichert");
    qc.invalidateQueries({ queryKey: ["cash_counts"] });
  };

  const addMovement = async (sign: 1 | -1) => {
    const raw = Number(movAmount.replace(",", ".")) || 0;
    if (raw <= 0) { toast.error("Betrag eingeben"); return; }
    setMovSaving(true);
    const amount = raw * sign;
    const { error } = await (supabase as any).from("cash_movements").insert({
      amount,
      kind: sign > 0 ? "deposit" : "withdrawal",
      note: movNote || null,
      occurred_at: new Date().toISOString(),
    });
    setMovSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(sign > 0 ? "Einlage gebucht" : "Entnahme gebucht");
    setMovAmount(""); setMovNote("");
    qc.invalidateQueries({ queryKey: ["cash_movements_cum"] });
    qc.invalidateQueries({ queryKey: ["cash_movements_day"] });
  };

  const deleteMovement = async (id: string) => {
    const { error } = await (supabase as any).from("cash_movements").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Bewegung gelöscht");
    qc.invalidateQueries({ queryKey: ["cash_movements_cum"] });
    qc.invalidateQueries({ queryKey: ["cash_movements_day"] });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Kassenbestand · Bargeld</div>
          <div className="text-xl font-semibold tabular-nums mt-0.5">
            {expected.toFixed(2)} CHF{" "}
            <span className="text-xs text-muted-foreground font-normal">Soll (kumulativ)</span>
          </div>
        </div>
        <Banknote className="w-5 h-5 text-muted-foreground" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4 text-xs">
        <div className="rounded-xl bg-white/5 px-3 py-2">
          <div className="text-[10px] uppercase text-muted-foreground">Bar-Einnahmen (bis Ende Zeitraum)</div>
          <div className="text-sm font-semibold tabular-nums mt-0.5">+{cashInCum.toFixed(2)}</div>
        </div>
        <div className="rounded-xl bg-white/5 px-3 py-2">
          <div className="text-[10px] uppercase text-muted-foreground">Bar-Ausgaben (bis Ende Zeitraum)</div>
          <div className="text-sm font-semibold tabular-nums mt-0.5 text-destructive/90">−{cashOutCum.toFixed(2)}</div>
        </div>
        <div className="rounded-xl bg-white/5 px-3 py-2">
          <div className="text-[10px] uppercase text-muted-foreground">Einlagen/Entnahmen</div>
          <div className={`text-sm font-semibold tabular-nums mt-0.5 ${movementsTotal >= 0 ? "text-success" : "text-destructive/90"}`}>
            {movementsTotal >= 0 ? "+" : ""}{movementsTotal.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl bg-white/5 px-3 py-2">
          <div className="text-[10px] uppercase text-muted-foreground">Trinkgeld (im Umsatz)</div>
          <div className="text-sm font-semibold tabular-nums mt-0.5 text-success">+{tips.toFixed(2)}</div>
        </div>
        <div className="rounded-xl bg-accent/10 px-3 py-2">
          <div className="text-[10px] uppercase text-muted-foreground">Soll in der Kasse</div>
          <div className="text-sm font-semibold tabular-nums mt-0.5 text-accent">{expected.toFixed(2)}</div>
        </div>
      </div>


      {!singleDay ? (
        <div className="text-xs text-muted-foreground">Kassenzählung & Bewegungen sind nur pro Tag möglich — wähle einen einzelnen Tag oben.</div>
      ) : (
        <>
          {/* Einlage / Entnahme */}
          <div className="rounded-2xl bg-white/5 p-3 mb-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Bargeld einlegen oder entnehmen</div>
            <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_auto_auto] gap-2 items-end">
              <label className="text-xs">
                <div className="text-[10px] uppercase text-muted-foreground mb-1">Betrag CHF</div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={movAmount}
                  onChange={(e) => setMovAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-10 rounded-xl bg-white/5 px-3 outline-none tabular-nums focus:ring-2 focus:ring-accent/40"
                />
              </label>
              <label className="text-xs">
                <div className="text-[10px] uppercase text-muted-foreground mb-1">Grund / Notiz</div>
                <input
                  type="text"
                  value={movNote}
                  onChange={(e) => setMovNote(e.target.value)}
                  placeholder="z. B. Wechselgeld, Anfangsbestand, Safe-Drop"
                  className="w-full h-10 rounded-xl bg-white/5 px-3 outline-none focus:ring-2 focus:ring-accent/40"
                />
              </label>
              <button
                onClick={() => addMovement(1)}
                disabled={movSaving}
                className="h-10 px-3 rounded-xl bg-success/20 text-success text-xs font-semibold hover:bg-success/30 disabled:opacity-50 flex items-center gap-1"
              >
                + Einlegen
              </button>
              <button
                onClick={() => addMovement(-1)}
                disabled={movSaving}
                className="h-10 px-3 rounded-xl bg-destructive/20 text-destructive text-xs font-semibold hover:bg-destructive/30 disabled:opacity-50 flex items-center gap-1"
              >
                − Entnehmen
              </button>
            </div>

            {movementsDay.length > 0 && (
              <div className="mt-3 divide-y divide-border/30">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Bewegungen heute</div>
                {movementsDay.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 py-1.5 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ background: Number(m.amount) >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))" }} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{m.note || (m.kind === "deposit" ? "Einlage" : m.kind === "withdrawal" ? "Entnahme" : m.kind)}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(m.occurred_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                    <div className={`font-semibold tabular-nums ${Number(m.amount) >= 0 ? "text-success" : "text-destructive"}`}>
                      {Number(m.amount) > 0 ? "+" : ""}{Number(m.amount).toFixed(2)} CHF
                    </div>
                    <button onClick={() => deleteMovement(m.id)} className="text-[10px] text-muted-foreground hover:text-destructive">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kassenzählung */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
            <label className="text-xs">
              <div className="text-[10px] uppercase text-muted-foreground mb-1">Gezählt (Ist)</div>
              <input
                type="text"
                inputMode="decimal"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                placeholder="0.00"
                className="w-full h-10 rounded-xl bg-white/5 px-3 outline-none tabular-nums focus:ring-2 focus:ring-accent/40"
              />
            </label>
            <label className="text-xs md:col-span-2">
              <div className="text-[10px] uppercase text-muted-foreground mb-1">Notiz zur Zählung</div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="z. B. Nachzählung durch Chef"
                className="w-full h-10 rounded-xl bg-white/5 px-3 outline-none focus:ring-2 focus:ring-accent/40"
              />
            </label>
          </div>

          <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Ist</span>
                <span className="font-semibold tabular-nums">{hasCount ? countedNum.toFixed(2) : "—"} CHF</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Differenz</span>
                {hasCount ? (
                  <span className={`font-semibold tabular-nums flex items-center gap-1 ${Math.abs(diff) < 0.01 ? "text-success" : diff > 0 ? "text-accent" : "text-destructive"}`}>
                    {Math.abs(diff) >= 0.01 && <AlertTriangle className="w-3.5 h-3.5" />}
                    {diff > 0 ? "+" : ""}{diff.toFixed(2)} CHF
                  </span>
                ) : <span className="text-muted-foreground">—</span>}
              </div>
            </div>
            <button
              onClick={save}
              disabled={!hasCount || saving}
              className="glass rounded-xl px-3 h-10 text-xs flex items-center gap-2 hover:border-accent/40 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Speichere…" : "Zählung speichern"}
            </button>
          </div>

          {cashCountRow && (
            <div className="text-[10px] text-muted-foreground mt-3">
              Zuletzt gezählt: {new Date(cashCountRow.created_at).toLocaleString("de-CH")} · Soll damals {Number(cashCountRow.expected_amount).toFixed(2)} CHF · Ist {Number(cashCountRow.counted_amount).toFixed(2)} CHF
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

