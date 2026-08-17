/** Prüft, ob ein Kunde bereits bewertet hat bzw. den Newsletter abonniert hat. */
export type ReviewStatus = { alreadyReviewed: boolean; alreadySubscribed: boolean };

export async function getReviewStatus(
  db: any,
  opts: { customerId?: string | null; phone?: string | null },
): Promise<ReviewStatus> {
  const status: ReviewStatus = { alreadyReviewed: false, alreadySubscribed: false };
  try {
    if (opts.customerId) {
      const { data: c } = await db
        .from("customers")
        .select("newsletter_opt_in")
        .eq("id", opts.customerId)
        .maybeSingle();
      if (c?.newsletter_opt_in) status.alreadySubscribed = true;
    }

    if (opts.phone) {
      const { data: c2 } = await db
        .from("customers")
        .select("newsletter_opt_in")
        .eq("phone", opts.phone)
        .eq("newsletter_opt_in", true)
        .limit(1);
      if ((c2?.length ?? 0) > 0) status.alreadySubscribed = true;
    }

    let q = db.from("review_requests").select("rating, newsletter_opt_in").limit(50);
    if (opts.customerId) q = q.eq("customer_id", opts.customerId);
    else if (opts.phone) q = q.eq("phone", opts.phone);
    else return status;

    const { data: rows } = await q;
    for (const r of rows ?? []) {
      if (r.rating != null) status.alreadyReviewed = true;
      if (r.newsletter_opt_in === true) status.alreadySubscribed = true;
    }
  } catch (e) {
    console.error("[reviews] status", e);
  }
  return status;
}
