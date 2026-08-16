import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getNewsletterDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const db = supabaseAdmin as any;

  const { data: subscribers, error } = await db
    .from("customers")
    .select("id, first_name, last_name, phone, city, newsletter_opt_in_at")
    .eq("newsletter_opt_in", true)
    .order("newsletter_opt_in_at", { ascending: false });
  if (error) throw new Error(error.message);

  const { data: reviews } = await db
    .from("review_requests")
    .select("id, customer_name, rating, comment, responded_at, newsletter_opt_in, sent_at, send_error")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: campaigns } = await db
    .from("marketing_campaigns")
    .select("id, message, recipient_count, failed_count, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const rated = (reviews ?? []).filter((r: any) => r.rating != null);
  const avgRating = rated.length
    ? rated.reduce((s: number, r: any) => s + Number(r.rating), 0) / rated.length
    : null;

  const { count: declined } = await db
    .from("review_requests")
    .select("id", { count: "exact", head: true })
    .eq("newsletter_opt_in", false);

  return {
    subscribers: (subscribers ?? []).map((c: any) => ({
      id: c.id as string,
      name: [c.last_name, c.first_name].filter(Boolean).join(" ").trim() || "Ohne Namen",
      phone: (c.phone ?? "") as string,
      city: (c.city ?? "") as string,
      optInAt: (c.newsletter_opt_in_at ?? null) as string | null,
    })),
    reviews: (reviews ?? []).map((r: any) => ({
      id: r.id as string,
      customerName: (r.customer_name ?? null) as string | null,
      rating: (r.rating ?? null) as number | null,
      comment: (r.comment ?? null) as string | null,
      respondedAt: (r.responded_at ?? null) as string | null,
      sentAt: (r.sent_at ?? null) as string | null,
      sendError: (r.send_error ?? null) as string | null,
    })),
    campaigns: (campaigns ?? []).map((c: any) => ({
      id: c.id as string,
      message: c.message as string,
      recipientCount: Number(c.recipient_count ?? 0),
      failedCount: Number(c.failed_count ?? 0),
      createdAt: c.created_at as string,
    })),
    stats: {
      subscriberCount: (subscribers ?? []).length,
      declinedCount: declined ?? 0,
      reviewCount: rated.length,
      avgRating,
    },
  };
});

export const sendNewsletterCampaign = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        message: z.string().min(5).max(400),
        sentBy: z.string().max(80).optional(),
        customerIds: z.array(z.string().uuid()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const db = supabaseAdmin as any;
    const { sendSms, toMsisdn } = await import("@/lib/sms.server");

    let query = db
      .from("customers")
      .select("id, phone")
      .eq("newsletter_opt_in", true);
    if (data.customerIds?.length) query = query.in("id", data.customerIds);
    const { data: recipients, error } = await query;
    if (error) throw new Error(error.message);
    if (!recipients?.length) throw new Error("Keine Empfänger mit Newsletter-Zustimmung");

    let sent = 0;
    let failed = 0;
    for (const c of recipients) {
      const to = toMsisdn(c.phone);
      if (!to) {
        failed++;
        continue;
      }
      try {
        await sendSms(to, data.message, `campaign-${c.id}-${Date.now()}`);
        sent++;
      } catch {
        failed++;
      }
    }

    await db.from("marketing_campaigns").insert({
      message: data.message,
      recipient_count: sent,
      failed_count: failed,
      sent_by: data.sentBy ?? null,
    });

    return { sent, failed };
  });
