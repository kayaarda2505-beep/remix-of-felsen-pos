import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

const Schema = z.object({
  qrToken: z.string().min(4).max(64),
  returnUrl: z.string().url(),
  environment: z.enum(["sandbox", "live"]),
});

export const Route = createFileRoute("/api/public/payments/create-table-checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = Schema.parse(await request.json());
          const stripe = createStripeClient(payload.environment as StripeEnv);

          const { data: table, error: tableError } = await supabaseAdmin
            .from("dining_tables")
            .select("id, name")
            .eq("qr_token", payload.qrToken)
            .maybeSingle();

          if (tableError) throw new Error(tableError.message);
          if (!table) return new Response("QR-Code ungültig", { status: 404 });

          const { data: order, error: orderError } = await supabaseAdmin
            .from("orders")
            .select("id, total")
            .eq("table_id", table.id)
            .eq("status", "open")
            .order("opened_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (orderError) throw new Error(orderError.message);
          const total = Number(order?.total ?? 0);
          if (!order || !(total > 0)) return new Response("Keine offene Rechnung gefunden", { status: 400 });

          const amountInCents = Math.round(total * 100);
          if (amountInCents < 50) return new Response("Betrag zu klein für Online-Bezahlung", { status: 400 });

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
            return_url: payload.returnUrl,
            payment_intent_data: {
              description: `Tisch ${table.name} – Bestellung ${order.id.slice(0, 8)}`,
            },
            metadata: {
              order_id: order.id,
              table_id: table.id,
              table_name: table.name,
              amount: String(total),
            },
          });

          if (!session.client_secret) throw new Error("Keine Checkout-Session erhalten");
          return Response.json({ clientSecret: session.client_secret });
        } catch (error) {
          console.error("create-table-checkout error", error);
          return new Response(error instanceof Error ? error.message : "Checkout konnte nicht gestartet werden", { status: 500 });
        }
      },
    },
  },
});