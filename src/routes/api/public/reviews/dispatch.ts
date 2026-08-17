import { createFileRoute } from "@tanstack/react-router";

async function dispatchDueReviews() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { sendSms, toMsisdn } = await import("@/lib/sms.server");

  const { data: due, error } = await db
    .from("review_requests")
    .select("id, token, phone, customer_name, customer_id")
    .is("sent_at", null)
    .lte("send_after", new Date().toISOString())
    .limit(25);
  if (error) throw new Error(error.message);

  const base = process.env["PUBLIC_SITE_URL"] ?? "https://felsens-pos-glow.lovable.app";
  let sent = 0;
  let failed = 0;

  for (const r of due ?? []) {
    const recipient = toMsisdn(r.phone);
    if (!recipient) {
      await db
        .from("review_requests")
        .update({ sent_at: new Date().toISOString(), send_error: "Keine gültige Mobilnummer" })
        .eq("id", r.id);
      failed++;
      continue;
    }
    const { getReviewStatus } = await import("@/lib/review-eligibility.server");
    const status = await getReviewStatus(db, { customerId: r.customer_id, phone: r.phone });

    if (status.alreadySubscribed) {
      // Kunde ist bereits Abonnent -> keine weitere Bewertungs-/Newsletter-Anfrage
      await db
        .from("review_requests")
        .update({ sent_at: new Date().toISOString(), send_error: "Übersprungen (bereits Abonnent)" })
        .eq("id", r.id);
      continue;
    }

    const message = status.alreadyReviewed
      ? `Piratino: Danke für deine Bestellung! Angebote per SMS erhalten? Hier Ja/Nein: ${base}/bewertung/${r.token}`
      : `Piratino: Wie hat's geschmeckt? Bewerte uns direkt bei Google: https://maps.google.com/?cid=4104131751984087472 - Angebote per SMS erhalten? Hier Ja/Nein: ${base}/bewertung/${r.token}`;

    try {
      await sendSms(recipient, message, `review-${r.id}`);
      await db
        .from("review_requests")
        .update({ sent_at: new Date().toISOString(), send_error: null })
        .eq("id", r.id);
      sent++;
    } catch (e) {
      await db
        .from("review_requests")
        .update({
          sent_at: new Date().toISOString(),
          send_error: e instanceof Error ? e.message : "SMS Fehler",
        })
        .eq("id", r.id);
      failed++;
    }
  }

  return { sent, failed, checked: (due ?? []).length };
}

export const Route = createFileRoute("/api/public/reviews/dispatch")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await dispatchDueReviews();
          return Response.json(result);
        } catch (e) {
          console.error("[reviews/dispatch]", e);
          return Response.json({ error: "dispatch failed" }, { status: 200 });
        }
      },
      GET: async () => {
        try {
          const result = await dispatchDueReviews();
          return Response.json(result);
        } catch (e) {
          console.error("[reviews/dispatch]", e);
          return Response.json({ error: "dispatch failed" }, { status: 200 });
        }
      },
    },
  },
});
