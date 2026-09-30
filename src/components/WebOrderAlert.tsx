import { useCallback, useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { printBill } from "@/lib/receipt";
import alarmAsset from "@/assets/piratino-bestell-alarm.wav.asset.json";

type WebOrder = {
  id: string;
  order_type: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  delivery_address: string | null;
  delivery_note: string | null;
  total: number | null;
  opened_at?: string | null;
};

const COLS =
  "id, order_type, contact_name, contact_phone, delivery_address, delivery_note, total, opened_at";

/** Website-Bestellungen: Alarmton + Popup auf jedem Bildschirm, bis jemand annimmt. */
export function WebOrderAlert() {
  const [queue, setQueue] = useState<WebOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const add = useCallback((o: WebOrder) => {
    setQueue((q) => (q.some((x) => x.id === o.id) ? q : [...q, o]));
  }, []);
  const remove = useCallback((id: string) => {
    setQueue((q) => q.filter((x) => x.id !== id));
  }, []);

  const loadPending = useCallback(async () => {
    const since = new Date(Date.now() - 6 * 3600_000).toISOString();
    const { data } = await (supabase as any)
      .from("orders")
      .select(COLS)
      .eq("opened_by_name", "Website")
      .is("web_accepted_at", null)
      .gte("opened_at", since)
      .order("opened_at", { ascending: true });
    const list = (data ?? []) as WebOrder[];
    setQueue((q) => {
      const ids = new Set(list.map((o) => o.id));
      // Von anderem Gerät angenommen → entfernen
      return list.concat(q.filter((x) => ids.has(x.id) && !list.some((l) => l.id === x.id)));
    });
  }, []);

  useEffect(() => {
    void loadPending();
    const ch = supabase
      .channel(`web_orders_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (p: any) => {
        const r = p.new;
        if (r?.opened_by_name === "Website" && !r.web_accepted_at) add(r);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (p: any) => {
        if (p.new?.web_accepted_at) remove(p.new.id);
      })
      .subscribe();
    const poll = window.setInterval(() => void loadPending(), 15000);
    return () => {
      supabase.removeChannel(ch);
      window.clearInterval(poll);
    };
  }, [add, remove, loadPending]);

  // Alarmton in Schleife, solange Bestellungen offen sind
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

  const accept = async (o: WebOrder) => {
    setBusy(true);
    try {
      const { error } = await (supabase as any)
        .from("orders")
        .update({ web_accepted_at: new Date().toISOString() })
        .eq("id", o.id)
        .is("web_accepted_at", null);
      if (error) throw error;
      remove(o.id);

      const [{ data: items }, { data: printers }] = await Promise.all([
        (supabase as any)
          .from("order_items")
          .select("product_name, qty, unit_price, category, modifiers, note")
          .eq("order_id", o.id),
        (supabase as any).from("printers").select("*").eq("active", true),
      ]);
      const isDelivery = o.order_type === "delivery";
      const billError = await printBill({
        printers: (printers ?? []) as any,
        tableName: o.delivery_address ?? o.contact_name ?? "Website",
        items: ((items ?? []) as any[]).map((i) => ({
          product_name: i.product_name,
          qty: i.qty,
          unit_price: Number(i.unit_price),
          category: i.category,
          modifiers: [
            ...((i.modifiers ?? []) as unknown[]).filter((m): m is string => typeof m === "string"),
            ...(i.note ? [String(i.note)] : []),
          ],
        })) as any,
        total: Number(o.total ?? 0),
        interim: true,
        title: isDelivery ? "LIEFERSCHEIN · WEBSITE" : "TAKEAWAY · WEBSITE",
        footerNote: o.delivery_note ? `Notiz: ${o.delivery_note}` : "Offen — beim Kunden kassieren",
        ...(isDelivery
          ? {
              qrUrl: `${window.location.origin}/kurier/${o.id}`,
              qrLabel: "QR scannen: Adresse, Navigation & Anruf",
            }
          : {}),
      });
      if (billError) toast.error(`Quittung: ${billError}`);
      else toast.success("Bestellung angenommen — Quittung wird gedruckt");
    } catch (e: any) {
      toast.error(e?.message ?? "Annehmen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  if (!active) return null;
  const o = queue[0];
  const isDelivery = o.order_type === "delivery";
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
        <div className="bg-primary text-primary-foreground p-7 flex flex-col items-center text-center gap-2">
          <Globe className="w-14 h-14 animate-pulse" strokeWidth={1.5} />
          <div className="text-2xl font-bold">Neue Website-Bestellung</div>
          <div className="text-sm font-semibold uppercase tracking-wider opacity-90">
            {isDelivery ? "Lieferung" : "Takeaway"}
          </div>
          {queue.length > 1 && (
            <div className="text-xs opacity-90">+{queue.length - 1} weitere</div>
          )}
        </div>
        <div className="p-5 space-y-1 text-sm">
          <div className="font-semibold text-base">{o.contact_name ?? "Gast"}</div>
          {o.contact_phone && <div className="text-muted-foreground">{o.contact_phone}</div>}
          {isDelivery && o.delivery_address && (
            <div className="text-muted-foreground">{o.delivery_address}</div>
          )}
          {o.delivery_note && <div className="italic">„{o.delivery_note}"</div>}
          <div className="pt-2 text-lg font-bold">CHF {Number(o.total ?? 0).toFixed(2)}</div>
        </div>
        <div className="p-4 pt-0">
          <button
            disabled={busy}
            onClick={() => void accept(o)}
            className="w-full rounded-xl bg-accent text-accent-foreground py-4 font-semibold text-lg flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Check className="w-5 h-5" />
            {busy ? "Wird angenommen…" : "Annehmen"}
          </button>
        </div>
      </div>
    </div>
  );
}
