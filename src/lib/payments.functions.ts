import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

const Input = z.object({
  qrToken: z.string().min(4).max(64),
  returnUrl: z.string().url(),
  environment: z.enum(["sandbox", "live"]),
});

export const createTableCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: z.infer<typeof Input>) => Input.parse(data))
  .handler(async ({ data }) => {
    const stripe = createStripeClient(data.environment as StripeEnv);

    const { data: table, error: tErr } = await supabaseAdmin
      .from("dining_tables")
      .select("id, name")
      .eq("qr_token", data.qrToken)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!table) throw new Error("QR-Code ungültig");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, total")
      .eq("table_id", table.id)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const totalNum = Number(order?.total ?? 0);
    if (!order || !(totalNum > 0)) {
      throw new Error("Keine offene Rechnung gefunden");
    }
    const amountInCents = Math.round(totalNum * 100);
    if (amountInCents < 50) throw new Error("Betrag zu klein für Online-Bezahlung");

    // Create payment_request now (status 'pending') so we can reference it
    const { data: pr, error: prErr } = await supabaseAdmin
      .from("payment_requests")
      .insert({
        table_id: table.id,
        table_name: table.name,
        order_id: order.id,
        amount: totalNum,
        method: "stripe",
        status: "pending",
      })
      .select("id")
      .single();
    if (prErr || !pr) throw new Error(prErr?.message ?? "Fehler beim Erstellen");

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "chf",
            product_data: { name: `Tisch ${table.name} – Rechnung` },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      payment_intent_data: {
        description: `Tisch ${table.name} – Bestellung ${order.id.slice(0, 8)}`,
      },
      metadata: {
        payment_request_id: pr.id,
        order_id: order.id,
        table_id: table.id,
        table_name: table.name,
      },
    });

    return session.client_secret;
  });
