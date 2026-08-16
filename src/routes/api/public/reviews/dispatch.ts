import { createFileRoute } from "@tanstack/react-router";

async function dispatchDueReviews() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { sendSms, toMsisdn } = await import("@/lib/sms.server");

  const { data: due, error } = await db
    .from("review_requests")
    .select("id, token, phone, customer_name")
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
    try {
      await sendSms(
        recipient,
        `Piratino: Wie hat's geschmeckt? Bewerte uns in 10 Sekunden: ${base}/bewertung/${r.token}`,
        `review-${r.id}`,
      );
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
