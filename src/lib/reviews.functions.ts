import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TokenSchema = z.object({ token: z.string().min(8).max(80) });

export const getReviewRequest = createServerFn({ method: "GET" })
  .inputValidator((input) => TokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await (supabaseAdmin as any)
      .from("review_requests")
      .select("id, customer_id, phone, customer_name, rating, comment, newsletter_opt_in, responded_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { review: null };
    const { getReviewStatus } = await import("./review-eligibility.server");
    const status = await getReviewStatus(supabaseAdmin as any, {
      customerId: (row.customer_id ?? null) as string | null,
      phone: (row.phone ?? null) as string | null,
    });
    return {
      review: {
        customerName: (row.customer_name ?? null) as string | null,
        rating: (row.rating ?? null) as number | null,
        comment: (row.comment ?? null) as string | null,
        newsletterOptIn: (row.newsletter_opt_in ?? null) as boolean | null,
        alreadySubscribed: status.alreadySubscribed,
        alreadyReviewed: status.alreadyReviewed,
      },
    };
  });

export const submitReview = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        token: z.string().min(8).max(80),
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any)
      .from("review_requests")
      .update({
        rating: data.rating,
        comment: data.comment?.trim() || null,
        responded_at: new Date().toISOString(),
      })
      .eq("token", data.token);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setNewsletterOptIn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ token: z.string().min(8).max(80), optIn: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = supabaseAdmin as any;
    const { data: row, error } = await db
      .from("review_requests")
      .update({ newsletter_opt_in: data.optIn })
      .eq("token", data.token)
      .select("customer_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row?.customer_id) {
      await db
        .from("customers")
        .update({
          newsletter_opt_in: data.optIn,
          newsletter_opt_in_at: data.optIn ? new Date().toISOString() : null,
        })
        .eq("id", row.customer_id);
    }
    return { ok: true };
  });
