import { createFileRoute } from "@tanstack/react-router";

// Empfängt Standorte der App „Traccar Client" (OsmAnd-Protokoll, Query oder JSON).
// Die Geräte-Kennung ist der geheime tracker_token des Kuriers.
async function handle(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams;
  let id = q.get("id") ?? q.get("deviceid");
  let lat = q.get("lat");
  let lng = q.get("lon") ?? q.get("lng");
  let acc = q.get("accuracy");

  if (request.method === "POST") {
    const text = await request.text().catch(() => "");
    if (text) {
      try {
        const b = JSON.parse(text);
        id = id ?? b.device_id ?? b.id ?? null;
        const c = b.location?.coords ?? b;
        lat = lat ?? String(c.latitude ?? c.lat ?? "");
        lng = lng ?? String(c.longitude ?? c.lon ?? c.lng ?? "");
        acc = acc ?? (c.accuracy != null ? String(c.accuracy) : null);
      } catch {
        const f = new URLSearchParams(text);
        id = id ?? f.get("id");
        lat = lat ?? f.get("lat");
        lng = lng ?? f.get("lon");
        acc = acc ?? f.get("accuracy");
      }
    }
  }

  const la = Number(lat);
  const lo = Number(lng);
  if (!id || !/^[a-f0-9]{12,40}$/i.test(id) || !Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
    return new Response("bad request", { status: 400 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data: member } = await db.from("team_members").select("id").eq("tracker_token", id).eq("active", true).maybeSingle();
  if (!member) return new Response("unknown device", { status: 404 });

  const { error } = await db.from("courier_locations").upsert(
    {
      member_id: member.id,
      lat: la,
      lng: lo,
      accuracy: acc != null && Number.isFinite(Number(acc)) ? Number(acc) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id" },
  );
  if (error) return new Response("error", { status: 500 });
  return new Response("ok");
}

export const Route = createFileRoute("/api/public/courier-location")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
