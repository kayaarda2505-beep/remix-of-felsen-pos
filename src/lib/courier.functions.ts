import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const IdSchema = z.object({ id: z.string().uuid() });

export const getCourierOrder = createServerFn({ method: "GET" })
  .inputValidator((input) => IdSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: order, error } = await (supabaseAdmin as any)
      .from("orders")
      .select("id, status, total, opened_at, order_type, delivery_address, delivery_note, customer_id, courier_started_at, courier_name")
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
    const base = process.env["PUBLIC_SITE_URL"] ?? "https://felsens-pos-glow.lovable.app";
    await sendSms(
      recipient,
      `Piratino: Deine Bestellung ist unterwegs! Live-Standort & Ankunftszeit: ${base}/track/${token}`,
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



const CompleteSchema = z.object({
  id: z.string().uuid(),
  method: z.enum(["cash", "card", "twint"]),
  tip: z.number().min(0).max(1000).optional(),
});

export const completeCourierDelivery = createServerFn({ method: "POST" })
  .inputValidator((input) => CompleteSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: order, error: oErr } = await (supabaseAdmin as any)
      .from("orders")
      .select("id, status, total")
      .eq("id", data.id)
      .eq("order_type", "delivery")
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!order) throw new Error("Bestellung nicht gefunden");
    if (order.status === "paid") return { ok: true, alreadyPaid: true };

    const { data: existing } = await (supabaseAdmin as any)
      .from("payment_requests")
      .select("amount")
      .eq("order_id", data.id)
      .eq("status", "paid");
    const alreadyPaid = (existing ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
    const open = Math.max(0, Number(order.total) - alreadyPaid);

    if (open > 0 || (existing ?? []).length === 0) {
      const { error: pErr } = await (supabaseAdmin as any).from("payment_requests").insert({
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

    const { error: uErr } = await (supabaseAdmin as any)
      .from("orders")
      .update({ status: "paid", closed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (uErr) throw new Error(uErr.message);

    await scheduleReviewRequest(data.id);

    return { ok: true, amount: open, method: data.method };
  });

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
      .select("id, status, total, opened_at, closed_at, delivery_address, delivery_note, courier_started_at, courier_assigned_at")
      .eq("order_type", "delivery")
      .eq("courier_id", data.courierId)
      .order("opened_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const all = (rows ?? []) as any[];
    return {
      active: all.filter((o) => o.status === "open"),
      history: all.filter((o) => o.status !== "open"),
    };
  });

// --- E-Mail/Passwort Login für Kuriere ---

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function memberForUser(userId: string) {
  const { data, error } = await (supabaseAdmin as any)
    .from("team_members")
    .select("id, name, role, active")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.active === false) return null;
  return { id: data.id as string, name: data.name as string, role: data.role as string };
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
      .select("id, status, total, opened_at, closed_at, delivery_address, delivery_note, courier_started_at, courier_assigned_at")
      .eq("order_type", "delivery")
      .eq("courier_id", member.id)
      .order("opened_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const all = (rows ?? []) as any[];
    return {
      courier: member,
      active: all.filter((o) => o.status === "open"),
      history: all.filter((o) => o.status !== "open"),
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
