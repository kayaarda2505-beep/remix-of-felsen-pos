import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const VAT = 8.1;
const BUSINESS = ["Piratino Pizzeria", "Badenerstrasse 696", "8048 Zürich-Altstetten"];

type Closing = { id: string; z_number: number; period_start: string; period_end: string; closed_by: string | null };

const AREA: Record<string, string> = { dine_in: "Restaurant", takeaway: "Take Away", delivery: "Kurier" };
const METHOD: Record<string, string> = { cash: "Bar", card_terminal: "Karte", card: "Karte", twint: "TWINT", stripe: "Online", apple_pay: "Apple Pay", google_pay: "Google Pay" };

const chf = (n: number) => n.toFixed(2);
const dt = (s: string | Date) => new Date(s).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); }

async function loadData(from: string, to: string) {
  const [{ data: orders, error: e1 }, { data: pays, error: e2 }, { data: items, error: e3 }] = await Promise.all([
    supabase.from("orders").select("id, order_type, status, total, opened_by_name, created_at").gte("created_at", from).lt("created_at", to).limit(5000),
    supabase.from("payment_requests").select("order_id, amount, tip, method, status, created_at").eq("status", "paid").gte("created_at", from).lt("created_at", to).limit(5000),
    supabase.from("order_items").select("category, unit_price, qty, order_id").gte("sent_at", from).lt("sent_at", to).limit(20000),
  ]);
  if (e1 || e2 || e3) throw e1 || e2 || e3;
  const o = orders ?? [], p = pays ?? [];
  const valid = o.filter((x) => x.status !== "cancelled");
  const cancelled = o.filter((x) => x.status === "cancelled");
  const cancelledIds = new Set(cancelled.map((x) => x.id));
  const areas: Record<string, { count: number; total: number }> = {};
  for (const k of Object.keys(AREA)) areas[k] = { count: 0, total: 0 };
  for (const x of valid) { const a = (areas[x.order_type] ??= { count: 0, total: 0 }); a.count++; a.total += Number(x.total); }
  const gross = valid.reduce((s, x) => s + Number(x.total), 0);
  const methods: Record<string, { count: number; total: number }> = {};
  let tips = 0;
  for (const x of p) {
    const m = METHOD[x.method] ?? x.method;
    (methods[m] ??= { count: 0, total: 0 });
    methods[m].count++; methods[m].total += Number(x.amount);
    tips += Number(x.tip ?? 0);
  }
  const paidTotal = p.reduce((s, x) => s + Number(x.amount), 0);
  const cats: Record<string, number> = {};
  for (const i of items ?? []) { if (cancelledIds.has(i.order_id)) continue; const c = i.category || "Sonstiges"; cats[c] = (cats[c] ?? 0) + Number(i.unit_price) * i.qty; }

  const orderUser = new Map(o.map((x) => [x.id, x.opened_by_name || "Unbekannt"]));
  const users: Record<string, { count: number; total: number; tips: number; methods: Record<string, number> }> = {};
  const u = (n: string) => (users[n] ??= { count: 0, total: 0, tips: 0, methods: {} });
  for (const x of valid) { const r = u(x.opened_by_name || "Unbekannt"); r.count++; r.total += Number(x.total); }
  for (const x of p) {
    const r = u((x.order_id && orderUser.get(x.order_id)) || "Unbekannt");
    const m = METHOD[x.method] ?? x.method;
    r.methods[m] = (r.methods[m] ?? 0) + Number(x.amount);
    r.tips += Number(x.tip ?? 0);
  }
  return {
    areas, gross, vat: gross - gross / (1 + VAT / 100), methods, tips, paidTotal, open: Math.max(0, gross - paidTotal),
    cash: (methods["Bar"]?.total ?? 0) + 0, orderCount: valid.length,
    cancelled: { count: cancelled.length, total: cancelled.reduce((s, x) => s + Number(x.total), 0) },
    cats: Object.entries(cats).sort((a, b) => b[1] - a[1]), users: Object.entries(users).sort((a, b) => b[1].total - a[1].total),
  };
}
type Data = Awaited<ReturnType<typeof loadData>>;

function Row({ l, r, b }: { l: string; r: string; b?: boolean }) {
  return <div className={`row${b ? " b" : ""}`}><span>{l}</span><span>{r}</span></div>;
}

function ZReport({ d, z, from, to, by }: { d: Data; z: string; from: string; to: string; by: string }) {
  return (
    <>
      <div className="c b big">Z-BERICHT</div>
      <div className="c">{BUSINESS.map((l) => <div key={l}>{l}</div>)}</div>
      <hr />
      <Row l="Z-Nummer" r={z} b />
      <Row l="Von" r={dt(from)} />
      <Row l="Bis" r={dt(to)} />
      <Row l="Abschluss durch" r={by} />
      <hr />
      <div className="b">UMSATZ NACH BEREICH</div>
      {Object.entries(d.areas).map(([k, a]) => <Row key={k} l={`${AREA[k] ?? k} (${a.count})`} r={chf(a.total)} />)}
      <hr />
      <Row l="TOTAL BRUTTO CHF" r={chf(d.gross)} b />
      <Row l={`MWST ${VAT}% inkl.`} r={chf(d.vat)} />
      <Row l="Total Netto" r={chf(d.gross - d.vat)} />
      <hr />
      <div className="b">ZAHLUNGSARTEN</div>
      {Object.entries(d.methods).map(([m, v]) => <Row key={m} l={`${m} (${v.count})`} r={chf(v.total)} />)}
      <Row l="Offen / nicht bezahlt" r={chf(d.open)} />
      <Row l="Total bezahlt" r={chf(d.paidTotal)} b />
      <hr />
      <Row l="Trinkgeld" r={chf(d.tips)} />
      <Row l="Bargeld Soll (inkl. TG bar)" r={chf(d.cash)} b />
      <hr />
      <div className="b">WARENGRUPPEN</div>
      {d.cats.map(([c, v]) => <Row key={c} l={c} r={chf(v)} />)}
      <hr />
      <Row l="Anzahl Bestellungen" r={String(d.orderCount)} />
      <Row l="Ø pro Bestellung" r={chf(d.orderCount ? d.gross / d.orderCount : 0)} />
      <Row l={`Stornos (${d.cancelled.count})`} r={chf(d.cancelled.total)} />
      <hr />
      <div className="c">Gedruckt {dt(new Date())}</div>
      <div className="sign">Unterschrift: ____________________</div>
    </>
  );
}

function UserReport({ d, z, from, to }: { d: Data; z: string; from: string; to: string }) {
  return (
    <>
      <div className="c b big">BENUTZERABRECHNUNG</div>
      <div className="c">{BUSINESS[0]}</div>
      <hr />
      <Row l="Z-Nummer" r={z} />
      <Row l="Von" r={dt(from)} />
      <Row l="Bis" r={dt(to)} />
      {d.users.length === 0 && <div className="c">Keine Umsätze</div>}
      {d.users.map(([name, v]) => (
        <div key={name}>
          <hr />
          <div className="b big">{name}</div>
          <Row l={`Bestellungen`} r={String(v.count)} />
          <Row l="Umsatz" r={chf(v.total)} b />
          {Object.entries(v.methods).map(([m, a]) => <Row key={m} l={`  ${m}`} r={chf(a)} />)}
          <Row l="Trinkgeld" r={chf(v.tips)} />
          <Row l="Abzugeben Bar" r={chf(v.methods["Bar"] ?? 0)} b />
          <div className="sign">Unterschrift: ______________</div>
        </div>
      ))}
      <hr />
      <Row l="TOTAL" r={chf(d.gross)} b />
      <div className="c">Gedruckt {dt(new Date())}</div>
    </>
  );
}

const PRINT_CSS = `body{font-family:'Courier New',monospace;font-size:13px;width:72mm;margin:0 auto;padding:4mm 0;color:#000}
.row{display:flex;justify-content:space-between;gap:8px;line-height:1.35}.b{font-weight:700}.c{text-align:center}.big{font-size:16px}
hr{border:0;border-top:1px dashed #000;margin:6px 0}.sign{margin-top:18px}@page{size:80mm auto;margin:0}`;

export function ReportDocuments({ doc }: { doc: "z" | "user" }) {
  const qc = useQueryClient();
  const { operator } = useAuth();
  const [sel, setSel] = useState<string>("current");
  const [busy, setBusy] = useState(false);

  const { data: closings = [] } = useQuery({
    queryKey: ["day_closings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("day_closings").select("id, z_number, period_start, period_end, closed_by").order("z_number", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as Closing[];
    },
  });

  const selected = closings.find((c) => c.id === sel);
  const nowIso = useMemo(() => new Date().toISOString(), [sel, closings.length]);
  const from = selected ? selected.period_start : closings[0]?.period_end ?? startOfToday();
  const to = selected ? selected.period_end : nowIso;
  const zLabel = selected ? `Z-${selected.z_number}` : `Z-${(closings[0]?.z_number ?? 0) + 1} (offen)`;
  const by = selected ? selected.closed_by ?? "—" : "—";

  const { data, isLoading, error } = useQuery({
    queryKey: ["report_docs", from, to],
    queryFn: () => loadData(from, to),
    refetchInterval: selected ? false : 30_000,
  });

  const print = () => {
    const el = document.getElementById("report-doc");
    if (!el) return;
    const w = window.open("", "_blank", "width=420,height=800");
    if (!w) return toast.error("Popup blockiert");
    w.document.write(`<html><head><title>${doc === "z" ? "Z-Bericht" : "Benutzerabrechnung"}</title><style>${PRINT_CSS}</style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 250);
  };

  const closeDay = async () => {
    if (!data) return;
    if (!confirm(`Tag jetzt abschliessen?\nUmsatz CHF ${chf(data.gross)}\nDanach beginnt ein neuer Geschäftstag.`)) return;
    setBusy(true);
    const end = new Date().toISOString();
    const { data: row, error } = await supabase.from("day_closings")
      .insert({ period_start: from, period_end: end, closed_by: operator?.name ?? null, totals: JSON.parse(JSON.stringify(data)) })
      .select("id").single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Tag abgeschlossen");
    await qc.invalidateQueries({ queryKey: ["day_closings"] });
    setSel(row.id);
  };

  return (
    <div className="p-6 grid lg:grid-cols-[1fr_auto] gap-6 items-start">
      <div className="space-y-4 max-w-md">
        <div className="glass rounded-2xl p-5 space-y-3">
          <label className="text-xs text-muted-foreground">Geschäftstag</label>
          <select value={sel} onChange={(e) => setSel(e.target.value)} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm">
            <option value="current">Aktueller Tag (seit {dt(from)})</option>
            {closings.map((c) => <option key={c.id} value={c.id}>Z-{c.z_number} · {dt(c.period_end)}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">Ein Tag endet erst mit „Tag abschliessen“ – nicht um Mitternacht.</p>
        </div>
        <button onClick={print} disabled={!data} className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-foreground py-3 font-medium disabled:opacity-50">
          <Printer className="w-4 h-4" /> {doc === "z" ? "Z-Bericht drucken" : "Benutzerabrechnung drucken"}
        </button>
        {!selected && (
          <button onClick={closeDay} disabled={!data || busy} className="w-full flex items-center justify-center gap-2 rounded-xl bg-destructive text-destructive-foreground py-3 font-medium disabled:opacity-50">
            <Lock className="w-4 h-4" /> Tag abschliessen
          </button>
        )}
      </div>
      <div className="bg-card text-card-foreground rounded-xl shadow p-5 w-[340px] font-mono text-[13px]">
        <style>{`#report-doc .row{display:flex;justify-content:space-between;gap:8px;line-height:1.35}#report-doc .b{font-weight:700}#report-doc .c{text-align:center}#report-doc .big{font-size:16px}#report-doc hr{border:0;border-top:1px dashed currentColor;margin:6px 0}#report-doc .sign{margin-top:18px}`}</style>
        {isLoading && <div>Lädt…</div>}
        {error && <div className="text-destructive">{(error as Error).message}</div>}
        {data && (
          <div id="report-doc">
            {doc === "z" ? <ZReport d={data} z={zLabel} from={from} to={to} by={by} /> : <UserReport d={data} z={zLabel} from={from} to={to} />}
          </div>
        )}
      </div>
    </div>
  );
}
