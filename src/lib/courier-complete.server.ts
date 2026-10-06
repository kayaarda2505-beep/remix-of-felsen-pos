import { z } from "zod";

export const CompleteSchema = z.object({
  id: z.string().uuid(),
  method: z.enum(["cash", "card", "twint"]),
  tip: z.number().min(0).max(1000).optional(),
});
export type CompleteInput = z.infer<typeof CompleteSchema>;

/** Kern des Kurier-Abschlusses; DB und Bewertungs-Planung werden injiziert (testbar). */
export async function runCompleteCourierDelivery(
  db: any,
  data: CompleteInput,
  scheduleReview: (orderId: string) => Promise<void>,
) {
  const { data: order, error: oErr } = await db
    .from("orders")
    .select("id, status, total")
    .eq("id", data.id)
    .eq("order_type", "delivery")
    .maybeSingle();
  if (oErr) throw new Error(oErr.message);
  if (!order) throw new Error("Bestellung nicht gefunden");
  if (order.status === "cancelled") throw new Error("Bestellung wurde storniert");
  if (order.status === "paid") {
    const { error: dErr } = await db
      .from("orders")
      .update({ courier_delivered_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("courier_delivered_at", null);
    if (dErr) throw new Error(dErr.message);
    await scheduleReview(data.id);
    return { ok: true, alreadyPaid: true };
  }

  const { data: existing, error: eErr } = await db
    .from("payment_requests")
    .select("amount")
    .eq("order_id", data.id)
    .eq("status", "paid");
  // Ohne bekannte Vorzahlungen nicht weiterbuchen, sonst droht eine Doppelbuchung.
  if (eErr) throw new Error(eErr.message);
  const rows = existing ?? [];
  const alreadyPaid = rows.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const open = Math.max(0, Math.round((Number(order.total) - alreadyPaid) * 100) / 100);

  if (open > 0 || rows.length === 0) {
    const { error: pErr } = await db.from("payment_requests").insert({
      order_id: data.id,
      amount: open,
      method: data.method,
      status: "paid",
      tip: data.tip ?? 0,
      handled_at: new Date().toISOString(),
      note: "Kurier",
    });
    if (pErr) throw new Error(pErr.message);
  }

  const now = new Date().toISOString();
  const { error: uErr } = await db
    .from("orders")
    .update({ status: "paid", closed_at: now, courier_delivered_at: now })
    .eq("id", data.id);
  if (uErr) throw new Error(uErr.message);

  await scheduleReview(data.id);
  return { ok: true, amount: open, method: data.method };
}
