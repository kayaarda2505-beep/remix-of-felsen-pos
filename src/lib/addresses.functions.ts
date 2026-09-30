import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ZipSchema = z.object({ zip: z.string().min(4).max(5) });
const StreetSchema = z.object({
  zip: z.string().min(4).max(5),
  query: z.string().max(60).optional(),
});

function gatewayHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) throw new Error("Google Maps ist nicht verbunden");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
  };
}

/** Ermittelt Ort und Mittelpunkt zu einer Schweizer Postleitzahl. */
export const lookupZip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ZipSchema.parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(
      `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?components=${encodeURIComponent(
        `postal_code:${data.zip}|country:CH`,
      )}&region=ch&language=de`,
      { headers: gatewayHeaders() },
    );
    if (!res.ok) throw new Error(`PLZ-Suche fehlgeschlagen [${res.status}]`);
    const json = (await res.json()) as {
      results?: {
        address_components: { long_name: string; types: string[] }[];
        geometry: { location: { lat: number; lng: number } };
      }[];
    };
    const first = json.results?.[0];
    if (!first) return { city: null as string | null, lat: null as number | null, lng: null as number | null };
    const city =
      first.address_components.find((c) => c.types.includes("locality"))?.long_name ??
      first.address_components.find((c) => c.types.includes("postal_town"))?.long_name ??
      null;
    return { city, lat: first.geometry.location.lat, lng: first.geometry.location.lng };
  });

/** Liefert alle Strassen einer PLZ aus dem amtlichen Strassenverzeichnis der Schweiz (swisstopo). */
export const searchStreets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => StreetSchema.parse(input))
  .handler(async ({ data }) => {
    const url =
      "https://api3.geo.admin.ch/rest/services/api/MapServer/find?layer=ch.swisstopo.amtliches-strassenverzeichnis" +
      `&searchText=${encodeURIComponent(data.zip)}&searchField=zip_label&returnGeometry=false&contains=true`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error("Strassenverzeichnis", res.status, await res.text());
        return { city: null as string | null, streets: [] as string[] };
      }
      const json = (await res.json()) as {
        results?: { attributes?: { stn_label?: string; zip_label?: string; str_type?: string; str_status?: string } }[];
      };
      const seen = new Map<string, string>();
      let city: string | null = null;
      for (const r of json.results ?? []) {
        const a = r.attributes;
        if (!a?.stn_label || !a.zip_label) continue;
        // zip_label kann mehrere PLZ enthalten ("8048 Zürich, 8047 Zürich")
        const labels = a.zip_label.split(",").map((z) => z.trim());
        const match = labels.find((z) => z.startsWith(`${data.zip} `));
        if (!match) continue;
        if (!city) city = match.slice(data.zip.length + 1).trim() || null;
        if (a.str_type === "Benanntes Gebiet") continue;
        if (a.str_status && a.str_status !== "bestehend") continue;
        const name = a.stn_label.trim();
        if (name.length < 3) continue;
        const key = name.toLowerCase();
        if (!seen.has(key)) seen.set(key, name);
      }
      return {
        city,
        streets: [...seen.values()].sort((x, y) => x.localeCompare(y, "de")),
      };
    } catch (e) {
      console.error("Strassenverzeichnis", e);
      return { city: null as string | null, streets: [] as string[] };
    }
  });
