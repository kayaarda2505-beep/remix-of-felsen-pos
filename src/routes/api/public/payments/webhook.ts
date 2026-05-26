import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

async function handleCheckoutCompleted(session: any) {
  const orderId = session?.metadata?.order_id;
  const tableId = session?.metadata?.table_id ?? null;
  const tableName = session?.metadata?.table_name ?? null;
  const metaAmount = Number(session?.metadata?.amount ?? 0);
  const amount = metaAmount > 0
    ? metaAmount
    : Number(session?.amount_total ?? 0) / 100;

  // Insert a single "paid" payment_request so staff get the notification beep
  // and revenue tracking works, without ever creating a pending "anfrage".
  await supabaseAdmin.from("payment_requests").insert({
    table_id: tableId,
    table_name: tableName,
    order_id: orderId ?? null,
    amount,
    method: "stripe",
    status: "paid",
    note: "Online bezahlt (Stripe)",
    handled_at: new Date().toISOString(),
  });

  if (orderId) {
    await supabaseAdmin
      .from("orders")
      .update({ status: "paid", closed_at: new Date().toISOString() })
      .eq("id", orderId);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          if (event.type === "checkout.session.completed") {
            await handleCheckoutCompleted(event.data.object);
          } else {
            console.log("Unhandled event:", event.type);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
