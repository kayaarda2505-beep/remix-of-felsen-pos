import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const IdSchema = z.object({ orderId: z.string().uuid() });

type Stage = "received" | "ready";

async function notify(orderId: string, stage: Stage): Promise<{ sent: boolean; error?: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: order } = await admin
      .from("orders")
      .select("id, order_type, customer_id, total")
      .eq("id", orderId)
      .maybeSingle();
    if (!order || order.order_type !== "delivery") return { sent: false, error: "Keine Lieferbestellung" };
    if (!order.customer_id) return { sent: false, error: "Kein Kunde hinterlegt" };

    const reference = `${stage}-${orderId}`;

    // Dedupe: pro Bestellung und Stufe nur einmal senden
    const { data: existing } = await admin
      .from("sms_events")
      .select("id")
      .eq("reference", reference)
      .limit(1);
    if (existing && existing.length > 0) return { sent: false, error: "Bereits gesendet" };

    const { data: customer } = await admin
      .from("customers")
      .select("first_name, phone")
      .eq("id", order.customer_id)
      .maybeSingle();

    const { toMsisdn, sendSms } = await import("@/lib/sms.server");
    const recipient = toMsisdn(customer?.phone);
    if (!recipient) return { sent: false, error: "Keine gültige Mobilnummer" };

    const hi = customer?.first_name ? `${customer.first_name}, ` : "";
    const message =
      stage === "received"
        ? `Piratino: ${hi}wir haben deine Bestellung erhalten (CHF ${Number(order.total ?? 0).toFixed(2)}). Wir starten sofort mit der Zubereitung.`
        : `Piratino: ${hi}deine Bestellung ist bereit und geht gleich auf den Weg zu dir.`;

    await sendSms(recipient, message, reference);

    await admin.from("sms_events").insert({
      recipient: String(recipient),
      reference,
      status: "sent",
      raw: { stage, order_id: orderId },
    });

    return { sent: true };
  } catch (e) {
    console.error("[order-sms]", stage, e);
    return { sent: false, error: e instanceof Error ? e.message : "SMS Fehler" };
  }
}

export const sendOrderReceivedSms = createServerFn({ method: "POST" })
  .inputValidator((input) => IdSchema.parse(input))
  .handler(async ({ data }) => notify(data.orderId, "received"));

export const sendOrderReadySms = createServerFn({ method: "POST" })
  .inputValidator((input) => IdSchema.parse(input))
  .handler(async ({ data }) => notify(data.orderId, "ready"));
