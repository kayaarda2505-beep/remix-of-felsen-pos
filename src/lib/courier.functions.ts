import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CompleteSchema, runCompleteCourierDelivery } from "./courier-complete.server";

const IdSchema = z.object({ id: z.string().uuid() });

export const getCourierOrder = createServerFn({ method: "GET" })
  .inputValidator((input) => IdSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: order, error } = await (supabaseAdmin as any)
      .from("orders")
      .select("id, status, total, opened_at, order_type, delivery_address, delivery_note, customer_id, courier_started_at, courier_delivered_at, courier_name")
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

    // Die beim Bestellen festgehaltene Adresse hat Vorrang: Kundenstammdaten
    // können später geändert oder von einer anderen Bestellung wiederverwendet werden.
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

    if (order.delivery_address) {
      const parts = order.delivery_address.split(" · ");
      const address = parts.length >= 2 ? parts[1] : order.delivery_address;
      const comma = address.lastIndexOf(", ");
      customer = {
        name: order.contact_name || (parts.length >= 2 ? parts[0] : customer?.name ?? ""),
        street: comma >= 0 ? address.slice(0, comma) : address,
        house_no: "",
        zip: comma >= 0 ? address.slice(comma + 2) : "",
        city: "",
        phone: order.contact_phone || (parts.length >= 3 ? parts[2] : customer?.phone ?? ""),
        note: customer?.note ?? null,
      };
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
        courier_delivered_at: (order as any).courier_delivered_at as string | null,
        courier_name: ((order as any).courier_name ?? null) as string | null,
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

async function sendTrackingSms(orderId: string, force = false): Promise<{ sent: boolean; error?: string }> {
  try {
    const { data: order } = await (supabaseAdmin as any)
      .from("orders")
      .select("id, customer_id, tracking_token, tracking_sms_sent_at")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { sent: false, error: "Bestellung nicht gefunden" };
    if (order.tracking_sms_sent_at && !force) return { sent: false, error: "SMS wurde bereits gesendet" };
    if (!order.customer_id) return { sent: false, error: "Kein Kunde hinterlegt" };

    const { data: customer } = await (supabaseAdmin as any)
      .from("customers")
      .select("phone")
      .eq("id", order.customer_id)
      .maybeSingle();

    const { toMsisdn, sendSms } = await import("@/lib/sms.server");
    const recipient = toMsisdn(customer?.phone);
    if (!recipient) return { sent: false, error: "Keine gültige Mobilnummer" };

    let token = order.tracking_token as string | null;
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, "");
      await (supabaseAdmin as any).from("orders").update({ tracking_token: token }).eq("id", orderId);
    }
    const base = process.env["PUBLIC_SITE_URL"] ?? "https://app.piratino-pizzeria.ch";
    await sendSms(
      recipient,
      `Piratino: Deine Bestellung ist unterwegs! Verfolge den Kurier live & sieh die voraussichtliche Ankunftszeit: ${base}/track/${token}`,
      `order-${orderId}-${Date.now()}`,
    );
    await (supabaseAdmin as any)
      .from("orders")
      .update({ tracking_sms_sent_at: new Date().toISOString() })
      .eq("id", orderId);
    return { sent: true };
  } catch (e) {
    console.error("[courier] SMS", e);
    return { sent: false, error: e instanceof Error ? e.message : "SMS Fehler" };
  }
}

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

    const sms = await sendTrackingSms(data.id);
    return { ok: true, sms };
  });

export const resendTrackingSms = createServerFn({ method: "POST" })
  .inputValidator((input) => IdSchema.parse(input))
  .handler(async ({ data }) => ({ sms: await sendTrackingSms(data.id, true) }));



export const completeCourierDelivery = createServerFn({ method: "POST" })
  .inputValidator((input) => CompleteSchema.parse(input))
  .handler(async ({ data }) => runCompleteCourierDelivery(supabaseAdmin, data, scheduleReviewRequest));

/** Plant 30 Minuten nach Lieferung eine Bewertungs-SMS ein. */
async function scheduleReviewRequest(orderId: string) {
  try {
    const db = supabaseAdmin as any;
    const { data: existing } = await db
      .from("review_requests")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();
    if (existing) return;

    const { data: order } = await db
      .from("orders")
      .select("customer_id, order_type")
      .eq("id", orderId)
      .maybeSingle();
    if (!order?.customer_id) return;

    const { data: c } = await db
      .from("customers")
      .select("phone, first_name, last_name")
      .eq("id", order.customer_id)
      .maybeSingle();
    if (!c?.phone) return;

    const { getReviewStatus } = await import("./review-eligibility.server");
    const status = await getReviewStatus(db, { customerId: order.customer_id, phone: c.phone });
    if (status.alreadySubscribed) return;

    await db.from("review_requests").insert({
      order_id: orderId,
      customer_id: order.customer_id,
      phone: c.phone,
      customer_name: [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || null,
      token: crypto.randomUUID().replace(/-/g, ""),
      send_after: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
  } catch (e) {
    console.error("[reviews] schedule", e);
  }
}


const LoginSchema = z.object({
  accountNumber: z.number().int().positive(),
  pin: z.string().regex(/^\d{4,6}$/),
});

export const courierLogin = createServerFn({ method: "POST" })
  .inputValidator((input) => LoginSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: rows, error } = await (supabaseAdmin as any).rpc("verify_team_pin", {
      _account_number: data.accountNumber,
      _pin: data.pin,
    });
    if (error) throw new Error(error.message);
    const m = Array.isArray(rows) ? rows[0] : rows;
    if (!m) return { courier: null };
    return { courier: { id: m.id as string, name: m.name as string, role: m.role as string } };
  });

export const listCourierOrders = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ courierId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("orders")
      .select("id, status, total, opened_at, closed_at, delivery_address, delivery_note, courier_started_at, courier_assigned_at, courier_delivered_at")
      .eq("order_type", "delivery")
      .eq("courier_id", data.courierId)
      .order("opened_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const all = (rows ?? []) as any[];
    return {
      active: all.filter((o) => !o.courier_delivered_at && o.status !== "cancelled"),
      history: all.filter((o) => !!o.courier_delivered_at || o.status === "cancelled"),
    };
  });

// --- E-Mail/Passwort Login für Kuriere ---

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function memberForUser(userId: string) {
  const { data, error } = await (supabaseAdmin as any)
    .from("team_members")
    .select("id, name, role, active, tracker_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.active === false) return null;
  return { id: data.id as string, name: data.name as string, role: data.role as string, trackerToken: (data.tracker_token ?? null) as string | null };
}

export const getMyCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ courier: await memberForUser(context.userId) }));

export const listMyCourierOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const member = await memberForUser(context.userId);
    if (!member) return { courier: null, active: [], history: [] };
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("orders")
      .select("id, status, total, opened_at, closed_at, delivery_address, delivery_note, courier_started_at, courier_assigned_at, courier_delivered_at")
      .eq("order_type", "delivery")
      .eq("courier_id", member.id)
      .order("opened_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const all = (rows ?? []) as any[];
    return {
      courier: member,
      active: all.filter((o) => !o.courier_delivered_at && o.status !== "cancelled"),
      history: all.filter((o) => !!o.courier_delivered_at || o.status === "cancelled"),
    };
  });

const AccountSchema = z.object({
  memberId: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

export const createCourierAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => AccountSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleErr } = await context.supabase.rpc("is_admin_or_manager", {
      _user_id: context.userId,
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!allowed) throw new Error("Keine Berechtigung");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created?.user) throw new Error(error?.message ?? "Konto konnte nicht erstellt werden");

    const { error: linkErr } = await (supabaseAdmin as any)
      .from("team_members")
      .update({ user_id: created.user.id, email: data.email })
      .eq("id", data.memberId);
    if (linkErr) throw new Error(linkErr.message);

    return { ok: true, email: data.email };
  });
