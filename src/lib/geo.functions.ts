import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Schema = z.object({ ids: z.array(z.string().uuid()).max(60) });

/**
 * Geokodiert Kundenadressen (nur solche ohne Koordinaten) und speichert
 * die Position beim Kunden, damit die Lieferkarte Stecknadeln zeigen kann.
 */
export const geocodeCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    if (data.ids.length === 0) return { updated: 0 };

    const lovableKey = process.env["LOVABLE_API_KEY"];
    const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
    if (!lovableKey || !mapsKey) throw new Error("Google Maps ist nicht verbunden");

    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("customers")
      .select("id, street, house_no, zip, city")
      .in("id", data.ids)
      .is("lat", null);
    if (error) throw new Error(error.message);

    let updated = 0;
    for (const c of rows ?? []) {
      const address = `${c.street} ${c.house_no}, ${c.zip} ${c.city}, Schweiz`.replace(/\s+/g, " ").trim();
      const res = await fetch(
        `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(
          address,
        )}&region=ch`,
        {
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": mapsKey,
          },
        },
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Geocoding fehlgeschlagen [${res.status}]: ${body}`);
      }
      const json = (await res.json()) as {
        status: string;
        results?: { geometry: { location: { lat: number; lng: number } } }[];
      };
      const loc = json.results?.[0]?.geometry?.location;
      if (!loc) continue;

      const { error: upErr } = await supabase
        .from("customers")
        .update({ lat: loc.lat, lng: loc.lng, geocoded_at: new Date().toISOString() })
        .eq("id", c.id);
      if (upErr) throw new Error(upErr.message);
      updated += 1;
    }

    return { updated };
  });
