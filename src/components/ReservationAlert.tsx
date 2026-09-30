import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { hasPrinterType } from "@/lib/receipt";
import { getAgentPrinters, printReceipt, type PrinterConfig, type ReceiptPayload } from "@/lib/printer-bridge";
import alarmAsset from "@/assets/piratino-bestell-alarm.wav.asset.json";

type Req = {
  id: string;
  kind: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  event_date: string | null;
  event_time: string | null;
  guests: number | null;
  message: string | null;
  created_at: string;
};

const COLS = "id, kind, name, phone, email, event_date, event_time, guests, message, created_at";
const kindLabel = (k: string) => (k === "catering" ? "Catering-Anfrage" : "Reservationsanfrage");

function buildTicket(r: Req): ReceiptPayload {
  const lines: ReceiptPayload["lines"] = [];
  lines.push({ text: "WEBSITE", align: "center", bold: true, size: "double-h" });
  lines.push({ text: kindLabel(r.kind).toUpperCase(), align: "center", bold: true, size: "double-h" });
  lines.push({ separator: true });
  if (r.event_date) lines.push({ text: `Datum:   ${r.event_date}`, bold: true, size: "double-h" });
  if (r.event_time) lines.push({ text: `Uhrzeit: ${r.event_time}`, bold: true, size: "double-h" });
  if (r.guests) lines.push({ text: `Personen: ${r.guests}`, bold: true, size: "double-h" });
  lines.push({ separator: true });
  if (r.name) lines.push({ text: r.name, bold: true });
  if (r.phone) lines.push({ text: `Tel. ${r.phone}` });
  if (r.email) lines.push({ text: r.email });
  if (r.message) {
    lines.push({ separator: true });
    lines.push({ text: "Nachricht:", bold: true });
    lines.push({ text: r.message });
  }
  lines.push({ separator: true });
  const d = new Date(r.created_at);
  lines.push({ text: `Eingang: ${d.toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}` });
  lines.push({ text: "" });
  return { lines, cut: true };
}

async function printRequest(r: Req): Promise<string | null> {
  const { data } = await (supabase as any).from("printers").select("*").eq("active", true);
  const printers = (data ?? []) as PrinterConfig[];
  let p = printers.find((x) => hasPrinterType(x, "rechnung")) ?? printers.find((x) => hasPrinterType(x, "bon"));
  if (!p) {
    const a = await getAgentPrinters();
    const def = a.printers?.find((x) => x.isDefault) ?? a.printers?.[0];
    if (!def) return "Kein Drucker gefunden";
    p = { id: "agent-default", name: def.name, type: "bon", ip_address: null, port: null };
  }
  const res = await printReceipt(p, buildTicket(r));
  return res.ok ? null : res.error ?? "Druckfehler";
}

/** Reservations-/Catering-Anfragen der Website: Ton + Popup, Druck beim Annehmen. */
export function ReservationAlert() {
  const [queue, setQueue] = useState<Req[]>([]);
  const [busy, setBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 48 * 3600_000).toISOString();
    const { data } = await (supabase as any)
      .from("reservation_requests").select(COLS)
      .is("accepted_at", null).gte("created_at", since)
      .order("created_at", { ascending: true });
    setQueue((data ?? []) as Req[]);
  }, []);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`res_req_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservation_requests" }, () => void load())
      .subscribe();
    const poll = window.setInterval(() => void load(), 15000);
    return () => {
      supabase.removeChannel(ch);
      window.clearInterval(poll);
    };
  }, [load]);

  const active = queue.length > 0;
  useEffect(() => {
    if (!active) {
      audioRef.current?.pause();
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio(alarmAsset.url);
      audioRef.current.loop = true;
    }
    audioRef.current.currentTime = 0;
    void audioRef.current.play().catch(() => {});
    return () => audioRef.current?.pause();
  }, [active]);

  const accept = async (r: Req) => {
    setBusy(true);
    try {
      const { error } = await (supabase as any)
        .from("reservation_requests").update({ accepted_at: new Date().toISOString() })
        .eq("id", r.id).is("accepted_at", null);
      if (error) throw error;
      setQueue((q) => q.filter((x) => x.id !== r.id));
      const err = await printRequest(r);
      if (err) toast.error(`Druck: ${err}`);
      else toast.success(`${kindLabel(r.kind)} angenommen — Bon wird gedruckt`);
    } catch (e: any) {
      toast.error(e?.message ?? "Annehmen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  if (!active) return null;
  const r = queue[0];
  return (
    <div className="fixed inset-0 z-[205] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
        <div className="bg-primary text-primary-foreground p-7 flex flex-col items-center text-center gap-2">
          <CalendarDays className="w-14 h-14 animate-pulse" strokeWidth={1.5} />
          <div className="text-2xl font-bold">Neue {kindLabel(r.kind)}</div>
          <div className="text-sm font-semibold uppercase tracking-wider opacity-90">Website</div>
          {queue.length > 1 && <div className="text-xs opacity-90">+{queue.length - 1} weitere</div>}
        </div>
        <div className="p-5 space-y-1 text-sm">
          <div className="text-lg font-bold">
            {[r.event_date, r.event_time].filter(Boolean).join(" · ") || "Datum offen"}
            {r.guests ? ` · ${r.guests} Pers.` : ""}
          </div>
          <div className="font-semibold text-base">{r.name ?? "Gast"}</div>
          {r.phone && <div className="text-muted-foreground">{r.phone}</div>}
          {r.email && <div className="text-muted-foreground">{r.email}</div>}
          {r.message && <div className="italic pt-1">„{r.message}"</div>}
        </div>
        <div className="p-4 pt-0">
          <button
            disabled={busy}
            onClick={() => void accept(r)}
            className="w-full rounded-xl bg-accent text-accent-foreground py-4 font-semibold text-lg flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Check className="w-5 h-5" />
            {busy ? "Wird angenommen…" : "Annehmen & drucken"}
          </button>
        </div>
      </div>
    </div>
  );
}
