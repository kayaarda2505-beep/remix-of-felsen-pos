import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isAutoPrintEnabled, isDesktopApp, pingPrintAgent, PRINT_AGENT_SETTINGS_EVENT } from "@/lib/printer-bridge";
import { printOrderToStations, type ReceiptItem } from "@/lib/receipt";

/**
 * Druckzentrale: Läuft auf jedem Gerät mit eingetragenem Print-Agent.
 * Fängt ALLE neuen Bestellpositionen ab (Service, QR-Gäste, Lieferung, Website)
 * und druckt die Stationsbons. Das Beanspruchen per claim_station_print
 * verhindert Doppeldrucke, falls mehrere Geräte die Druckzentrale sind.
 */
export function StationPrintHub() {
  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    let processing = false;
    let lastConnectionWarning = 0;

    const processOrder = async (orderId: string) => {
      timers.delete(orderId);
      if (!isDesktopApp() || !isAutoPrintEnabled()) return;
      if (!(await pingPrintAgent())) {
        if (Date.now() - lastConnectionWarning > 60_000) {
          toast.error("Automatischer Bondruck ist offline", {
            description: "Der Print-Agent ist auf diesem PC nicht erreichbar.",
          });
          lastConnectionWarning = Date.now();
        }
        return;
      }
      const { data: claimed, error } = await supabase.rpc("claim_station_print", { _order_id: orderId });
      if (error) {
        toast.error("Bestellung konnte nicht zum Drucken übernommen werden", { description: error.message });
        return;
      }
      if (!claimed?.length) return;
      const claimedIds = claimed.map((it: any) => it.id).filter(Boolean);
      const { data: order } = await supabase
        .from("orders")
        .select("order_type, contact_name, delivery_address, opened_by_name, table_id")
        .eq("id", orderId)
        .maybeSingle();
      let tableName = "?";
      let orderType: string | undefined;
      if (order?.table_id) {
        const { data: t } = await supabase.from("dining_tables").select("name").eq("id", order.table_id).maybeSingle();
        tableName = t?.name ?? "?";
      } else if (order?.order_type === "takeaway") {
        tableName = `Abholung · ${order.contact_name ?? ""}`;
        orderType = "Takeaway";
      } else if (order) {
        tableName = `${order.contact_name ?? ""} · ${order.delivery_address ?? ""}`;
        orderType = order.order_type === "delivery" ? "Lieferung" : order.order_type;
      }
      const items: ReceiptItem[] = claimed.map((it: any) => ({
        product_name: it.product_name,
        qty: Number(it.qty),
        unit_price: Number(it.unit_price),
        category: it.category,
        modifiers: Array.isArray(it.modifiers) ? it.modifiers : [],
        note: it.note ?? null,
      }));
      const { data: printers } = await supabase
        .from("printers")
        .select("id, name, type, ip_address, port")
        .eq("active", true);
      const errs = await printOrderToStations({
        printers: (printers ?? []) as any,
        tableName,
        items,
        orderType,
        operatorName: order?.opened_by_name ?? null,
      });
      if (errs.length) {
        // Erst nach einem erfolgreichen Ausdruck gilt eine Position als gedruckt.
        // Bei einem Agent-/Druckerfehler wieder freigeben, damit der nächste Lauf
        // den Auftrag erneut versucht statt ihn lautlos zu verlieren.
        if (claimedIds.length) {
          await supabase.from("order_items").update({ station_printed: false }).in("id", claimedIds);
        }
        errs.forEach((e) => toast.error(`Bon nicht gedruckt – ${e}`, { duration: 12000 }));
      }
    };

    const schedule = (orderId: string) => {
      const prev = timers.get(orderId);
      if (prev) clearTimeout(prev);
      // kurz warten, bis alle Positionen einer Bestellung angekommen sind
      timers.set(orderId, setTimeout(() => void processOrder(orderId), 1500));
    };

    // Nachholen und als Fallback pollen, falls die Live-Verbindung unterbrochen ist.
    const pollPending = async () => {
      if (processing || !isDesktopApp() || !isAutoPrintEnabled()) return;
      processing = true;
      const since = new Date(Date.now() - 2 * 3600_000).toISOString();
      try {
        const { data, error } = await supabase
          .from("order_items")
          .select("order_id")
          .eq("station_printed", false)
          .gte("sent_at", since);
        if (error) throw error;
        new Set((data ?? []).map((r: any) => r.order_id)).forEach((id) => schedule(id as string));
      } catch (e: any) {
        console.warn("Offene Druckaufträge konnten nicht geladen werden", e);
      } finally {
        processing = false;
      }
    };
    void pollPending();
    const pollInterval = window.setInterval(() => void pollPending(), 10_000);
    window.addEventListener(PRINT_AGENT_SETTINGS_EVENT, pollPending);

    const ch = supabase
      .channel(`station_print_hub_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_items" }, (p: any) => {
        if (p.new?.order_id && !p.new.station_printed) schedule(p.new.order_id);
      })
      .subscribe();

    return () => {
      timers.forEach((t) => clearTimeout(t));
      window.clearInterval(pollInterval);
      window.removeEventListener(PRINT_AGENT_SETTINGS_EVENT, pollPending);
      supabase.removeChannel(ch);
    };
  }, []);
  return null;
}
