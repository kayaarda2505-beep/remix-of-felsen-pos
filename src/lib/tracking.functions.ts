import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TokenSchema = z.object({ token: z.string().min(10).max(80) });

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const getTracking = createServerFn({ method: "GET" })
  .inputValidator((input) => TokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: order, error } = await db
      .from("orders")
      .select(
        "id, status, total, delivery_address, courier_id, courier_name, courier_started_at, closed_at, customer_id",
      )
      .eq("tracking_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return { tracking: null };

    let destination: { lat: number; lng: number } | null = null;
    let address = order.delivery_address as string | null;
    if (order.customer_id) {
      const { data: c } = await db
        .from("customers")
        .select("first_name, last_name, street, house_no, zip, city, lat, lng")
        .eq("id", order.customer_id)
        .maybeSingle();
      if (c) {
        address = `${c.street} ${c.house_no}, ${c.zip} ${c.city}`;
        if (c.lat != null && c.lng != null) destination = { lat: Number(c.lat), lng: Number(c.lng) };
      }
    }

    let courier: { lat: number; lng: number; updated_at: string } | null = null;
    if (order.courier_id && order.status !== "paid") {
      const { data: loc } = await db
        .from("courier_locations")
        .select("lat, lng, updated_at")
        .eq("member_id", order.courier_id)
        .maybeSingle();
      if (loc) courier = { lat: Number(loc.lat), lng: Number(loc.lng), updated_at: loc.updated_at };
    }

    let etaMinutes: number | null = null;
    let distanceKm: number | null = null;
    if (courier && destination) {
      distanceKm = haversineKm(courier, destination);
      etaMinutes = Math.max(1, Math.round((distanceKm / 22) * 60 + 2));
    }

    return {
      tracking: {
        status: order.status === "paid" || order.closed_at ? "delivered" : order.courier_started_at ? "enroute" : "preparing",
        courierName: (order.courier_name ?? null) as string | null,
        address,
        destination,
        courier,
        etaMinutes,
        distanceKm,
        total: Number(order.total ?? 0),
      },
    };
  });
