import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const ItemSchema = z.object({
  product_id: z.string().min(1).max(64).optional(),
  product_name: z.string().min(1).max(200),
  category: z.string().min(1).max(64).nullable().optional(),
  unit_price: z.number().min(0).max(10000),
  qty: z.number().int().min(1).max(99),
  note: z.string().max(500).nullable().optional(),
  modifiers: z.array(z.string().min(1).max(120)).max(30).optional(),
});

const Schema = z.object({
  type: z.enum(["delivery", "takeaway"]),
  customer: z.object({
    first_name: z.string().max(80).nullable().optional(),
    last_name: z.string().max(80).nullable().optional(),
    name: z.string().max(160).nullable().optional(),
    phone: z.string().min(6).max(30),
    street: z.string().max(120).nullable().optional(),
    house_no: z.string().max(20).nullable().optional(),
    zip: z.string().max(12).nullable().optional(),
    city: z.string().max(80).nullable().optional(),
  }),
  note: z.string().max(500).nullable().optional(),
  items: z.array(ItemSchema).min(1).max(60),
  external_id: z.string().max(120).nullable().optional(),
});

type Payload = z.infer<typeof Schema>;

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
};

function displayName(c: Payload["customer"]) {
  return (
    c.name?.trim() ||
    [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
    "Web-Bestellung"
  );
}

export const Route = createFileRoute("/api/public/orders/inbound")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const secret = process.env["WEBSITE_ORDER_SECRET"];
        if (!secret) {
          return Response.json({ error: "Webhook nicht konfiguriert" }, { status: 500, headers: cors });
        }
        const provided =
          request.headers.get("x-webhook-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!timingSafeEqual(provided, secret)) {
          return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
        }

        let payload: Payload;
        try {
          payload = Schema.parse(await request.json());
        } catch (e: any) {
          return Response.json({ error: `Ungültige Daten: ${e?.message ?? ""}` }, { status: 400, headers: cors });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        const isDelivery = payload.type === "delivery";
        const c = payload.customer;
        const phone = c.phone.trim();
        const name = displayName(c);

        if (isDelivery && (!c.street || !c.zip || !c.city)) {
          return Response.json(
            { error: "Für Lieferungen sind street, zip und city erforderlich" },
            { status: 400, headers: cors },
          );
        }

        // Idempotenz über external_id
        if (payload.external_id) {
          const { data: dup } = await admin
            .from("orders")
            .select("id")
            .eq("external_id", payload.external_id)
            .maybeSingle();
          if (dup) return Response.json({ ok: true, order_id: dup.id, duplicate: true }, { headers: cors });
        }

        let customerId: string | null = null;
        if (isDelivery) {
          const { data: existing } = await admin
            .from("customers")
            .select("id")
            .eq("phone", phone)
            .maybeSingle();
          if (existing) {
            customerId = existing.id;
          } else {
            const { data: created, error: cErr } = await admin
              .from("customers")
              .insert({
                first_name: c.first_name ?? null,
                last_name: c.last_name ?? name,
                phone,
                street: c.street,
                house_no: c.house_no ?? "",
                zip: c.zip,
                city: c.city,
              })
              .select("id")
              .single();
            if (cErr) return Response.json({ error: cErr.message }, { status: 500, headers: cors });
            customerId = created.id;
          }
        }

        const address = isDelivery
          ? `${name} · ${[c.street, c.house_no].filter(Boolean).join(" ")}, ${c.zip} ${c.city} · ${phone}`
          : `TAKEAWAY · ${name} · ${phone}`;

        const total = payload.items.reduce((s, i) => s + i.unit_price * i.qty, 0);

        const { data: order, error } = await admin
          .from("orders")
          .insert({
            status: "open",
            order_type: payload.type,
            customer_id: customerId,
            contact_phone: phone,
            contact_name: name,
            delivery_address: address,
            delivery_note: payload.note?.trim() || null,
            total,
            opened_by_name: "Website",
            external_id: payload.external_id ?? null,
          })
          .select("id")
          .single();
        if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });

        const { error: itemErr } = await admin.from("order_items").insert(
          payload.items.map((i) => ({
            order_id: order.id,
            product_id: i.product_id ?? null,
            product_name: i.product_name,
            category: i.category ?? null,
            unit_price: i.unit_price,
            qty: i.qty,
            note: i.note ?? null,
            modifiers: i.modifiers ?? [],
          })),
        );
        if (itemErr) return Response.json({ error: itemErr.message }, { status: 500, headers: cors });

        // Bestätigungs-SMS (darf die Bestellung nicht blockieren)
        try {
          const { notifyOrderReceived } = await import("@/lib/order-sms.server");
          await notifyOrderReceived(order.id as string, isDelivery ? undefined : 15);
        } catch (e) {
          console.error("[inbound] sms", e);
        }

        return Response.json({ ok: true, order_id: order.id, total }, { headers: cors });
      },
    },
  },
});
