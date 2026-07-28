import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const IdSchema = z.object({ id: z.string().uuid() });

export const getCourierOrder = createServerFn({ method: "GET" })
  .inputValidator((input) => IdSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: order, error } = await (supabaseAdmin as any)
      .from("orders")
      .select("id, status, total, opened_at, order_type, delivery_address, delivery_note, customer_id, courier_started_at")
      .eq("id", data.id)
      .eq("order_type", "delivery")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return { order: null };

    const { data: items, error: itemErr } = await supabaseAdmin
      .from("order_items")
      .select("id, product_name, qty, unit_price, note")
      .eq("order_id", order.id)
      .order("sent_at", { ascending: true });
    if (itemErr) throw new Error(itemErr.message);

    let customer: {
      name: string;
      street: string;
      house_no: string;
      zip: string;
      city: string;
      phone: string;
      note: string | null;
    } | null = null;

    if (order.customer_id) {
      const { data: c } = await supabaseAdmin
        .from("customers")
        .select("last_name, first_name, street, house_no, zip, city, phone, note")
        .eq("id", order.customer_id)
        .maybeSingle();
      if (c) {
        customer = {
          name: [c.last_name, c.first_name].filter(Boolean).join(" ").trim(),
          street: c.street,
          house_no: c.house_no,
          zip: c.zip,
          city: c.city,
          phone: c.phone,
          note: c.note,
        };
      }
    }

    const { data: payments } = await supabaseAdmin
      .from("payment_requests")
      .select("amount, method, status")
      .eq("order_id", order.id)
      .eq("status", "paid");

    const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);

    return {
      order: {
        id: order.id,
        status: order.status,
        total: Number(order.total),
        opened_at: order.opened_at,
        courier_started_at: (order as any).courier_started_at as string | null,
        delivery_address: order.delivery_address,
        delivery_note: order.delivery_note,
        items: (items ?? []).map((i) => ({
          id: i.id,
          name: i.product_name,
          qty: i.qty,
          unit_price: Number(i.unit_price),
          note: i.note,
        })),
        customer,
        paid,
        payment_method: payments?.[0]?.method ?? null,
      },
    };
  });

export const startCourierDelivery = createServerFn({ method: "POST" })
  .inputValidator((input) => IdSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any)
      .from("orders")
      .update({ courier_started_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("order_type", "delivery")
      .is("courier_started_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
