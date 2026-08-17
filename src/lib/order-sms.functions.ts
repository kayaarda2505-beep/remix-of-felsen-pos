import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ReceivedSchema = z.object({
  orderId: z.string().uuid(),
  etaMinutes: z.number().int().min(5).max(180).optional(),
});
const IdSchema = z.object({ orderId: z.string().uuid() });

type Stage = "received" | "ready";

/** Plant 30 Minuten nach Abholung/Lieferung eine Bewertungs-SMS ein. */
async function scheduleReview(admin: any, orderId: string, phone: string, name: string | null, customerId: string | null) {
  try {
    const { data: existing } = await admin
      .from("review_requests")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();
    if (existing) return;

    const { getReviewStatus } = await import("./review-eligibility.server");
    const status = await getReviewStatus(admin, { customerId, phone });
    // Bereits Newsletter-Abonnent -> weder Bewertung noch Newsletter erneut anfragen
    if (status.alreadySubscribed) return;

    await admin.from("review_requests").insert({
      order_id: orderId,
      customer_id: customerId,
      phone,
      customer_name: name,
      token: crypto.randomUUID().replace(/-/g, ""),
      send_after: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
  } catch (e) {
    console.error("[order-sms] scheduleReview", e);
  }
}

async function notify(
  orderId: string,
  stage: Stage,
  etaMinutes?: number,
): Promise<{ sent: boolean; error?: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: order } = await admin
      .from("orders")
      .select("id, order_type, customer_id, total, contact_phone, contact_name")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return { sent: false, error: "Bestellung nicht gefunden" };

    const type = order.order_type as string;
    if (type !== "delivery" && type !== "takeaway")
      return { sent: false, error: "Keine Liefer-/Takeaway-Bestellung" };

    const reference = `${stage}-${orderId}`;

    // Dedupe: pro Bestellung und Stufe nur einmal senden
    const { data: existing } = await admin
      .from("sms_events")
      .select("id")
      .eq("reference", reference)
      .limit(1);
    if (existing && existing.length > 0) return { sent: false, error: "Bereits gesendet" };

    let phone: string | null = order.contact_phone ?? null;
    let firstName: string | null = order.contact_name ?? null;
    let fullName: string | null = order.contact_name ?? null;

    if (order.customer_id) {
      const { data: customer } = await admin
        .from("customers")
        .select("first_name, last_name, phone")
        .eq("id", order.customer_id)
        .maybeSingle();
      if (customer) {
        phone = customer.phone ?? phone;
        firstName = customer.first_name ?? firstName;
        fullName =
          [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || fullName;
      }
    }

    const { toMsisdn, sendSms } = await import("@/lib/sms.server");
    const recipient = toMsisdn(phone);
    if (!recipient) return { sent: false, error: "Keine gültige Mobilnummer" };

    const hi = firstName ? `${firstName}` : "Ciao";
    const eta = etaMinutes ?? 25;
    let message: string;
    if (type === "takeaway") {
      message =
        stage === "received"
          ? `Piratino: ${hi}! Deine Bestellung CHF ${Number(order.total ?? 0).toFixed(2)} ist bei uns eingegangen. Wir machen sie frisch & sie ist in ca. ${eta} Min. abholbereit. Danke für deinen Besuch!`
          : `Piratino: ${hi}! Deine Bestellung ist frisch abholbereit. Wir freuen uns auf dich - Badenerstrasse 696, 8048 Zürich.`;
    } else {
      message =
        stage === "received"
          ? `Piratino: ${hi}! Deine Lieferbestellung CHF ${Number(order.total ?? 0).toFixed(2)} ist bei uns eingegangen. Der Pizzaiolo macht sich gleich ans Werk - wir melden uns, sobald sie unterwegs ist.`
          : `Piratino: ${hi}! Deine Bestellung ist bereit und geht auf die Reise zu dir. Guten Appetit!`;
    }

    await sendSms(recipient, message, reference);

    await admin.from("sms_events").insert({
      recipient: String(recipient),
      reference,
      status: "sent",
      raw: { stage, order_id: orderId, order_type: type },
    });

    // Takeaway: 30 Minuten nach "abholbereit" Bewertung + Newsletter anfragen
    if (type === "takeaway" && stage === "ready") {
      await scheduleReview(admin, orderId, String(phone), fullName, order.customer_id ?? null);
    }

    return { sent: true };
  } catch (e) {
    console.error("[order-sms]", stage, e);
    return { sent: false, error: e instanceof Error ? e.message : "SMS Fehler" };
  }
}

export const sendOrderReceivedSms = createServerFn({ method: "POST" })
  .inputValidator((input) => ReceivedSchema.parse(input))
  .handler(async ({ data }) => notify(data.orderId, "received", data.etaMinutes));

export const sendOrderReadySms = createServerFn({ method: "POST" })
  .inputValidator((input) => IdSchema.parse(input))
  .handler(async ({ data }) => notify(data.orderId, "ready"));
