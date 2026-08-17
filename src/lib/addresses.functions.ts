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

/** Liefert Strassen zu einer PLZ (Google Places Autocomplete, auf die PLZ eingegrenzt). */
export const searchStreets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => StreetSchema.parse(input))
  .handler(async ({ data }) => {
    const headers = gatewayHeaders();

    // Mittelpunkt der PLZ als Location-Bias, damit nur Strassen der Region kommen
    let center: { lat: number; lng: number } | null = null;
    let city: string | null = null;
    try {
      const geo = await fetch(
        `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?components=${encodeURIComponent(
          `postal_code:${data.zip}|country:CH`,
        )}&region=ch&language=de`,
        { headers },
      );
      const gj = (await geo.json()) as {
        results?: {
          address_components: { long_name: string; types: string[] }[];
          geometry: { location: { lat: number; lng: number } };
        }[];
      };
      const first = gj.results?.[0];
      if (first) {
        center = first.geometry.location;
        city =
          first.address_components.find((c) => c.types.includes("locality"))?.long_name ??
          first.address_components.find((c) => c.types.includes("postal_town"))?.long_name ??
          null;
      }
    } catch {
      center = null;
    }

    const term = (data.query ?? "").trim();
    // Ohne Suchbegriff das Alphabet anspielen, damit eine breite Strassenliste entsteht
    const inputs = term
      ? [`${term}, ${data.zip}${city ? ` ${city}` : ""}`]
      : "abcdefghiklmoprstuwz"
          .split("")
          .map((letter) => `${letter}, ${data.zip}${city ? ` ${city}` : ""}`);

    const seen = new Map<string, string>();
    const results = await Promise.all(
      inputs.map(async (input) => {
        const params = new URLSearchParams({
          input,
          types: "address",
          components: "country:ch",
          language: "de",
        });
        if (center) {
          params.set("location", `${center.lat},${center.lng}`);
          params.set("radius", "3000");
          params.set("strictbounds", "true");
        }
        try {
          const res = await fetch(
            `https://connector-gateway.lovable.dev/google_maps/maps/api/place/autocomplete/json?${params.toString()}`,
            { headers },
          );
          if (!res.ok) return [];
          const json = (await res.json()) as {
            predictions?: { structured_formatting?: { main_text?: string }; description?: string }[];
          };
          return json.predictions ?? [];
        } catch {
          return [];
        }
      }),
    );

    for (const preds of results) {
      for (const p of preds) {
        const main = (p.structured_formatting?.main_text ?? p.description ?? "").trim();
        if (!main) continue;
        // Hausnummern aus dem Vorschlag entfernen -> reiner Strassenname
        const street = main.replace(/\s+\d+[a-zA-Z]?$/, "").trim();
        if (street.length < 3) continue;
        const key = street.toLowerCase();
        if (!seen.has(key)) seen.set(key, street);
      }
    }

    return {
      city,
      streets: [...seen.values()].sort((a, b) => a.localeCompare(b, "de")).slice(0, 60),
    };
  });
