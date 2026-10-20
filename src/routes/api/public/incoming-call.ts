import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { phoneKey, phonesMatch } from "@/lib/phone-match";

const Schema = z.object({ phone: z.string().trim().min(3).max(40) });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** MicroSIP meldet eingehende Anrufe (Anrufernummer) – geschützt per CALL_WEBHOOK_SECRET. */
export const Route = createFileRoute("/api/public/incoming-call")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CALL_WEBHOOK_SECRET"];
        if (!secret) return Response.json({ error: "not configured" }, { status: 500 });
        const provided = request.headers.get("x-call-secret") ?? "";
        if (!safeEqual(provided, secret)) return Response.json({ error: "Unauthorized" }, { status: 401 });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "bad json" }, { status: 400 });
        }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return Response.json({ error: "phone missing" }, { status: 400 });
        // SIP-URIs wie "sip:0791234567@…" bereinigen
        const phone = parsed.data.phone.replace(/^sips?:/i, "").split("@")[0]!.replace(/[^\d+]/g, "");
        if (phoneKey(phone).length < 6) return Response.json({ ok: true, ignored: "anonymous" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        // Doppelte Meldungen (mehrfaches Klingeln) innerhalb 60 s ignorieren
        const since = new Date(Date.now() - 60_000).toISOString();
        const { data: recent } = await admin
          .from("incoming_calls").select("id").eq("phone", phone).gte("created_at", since).limit(1);
        if (recent?.length) return Response.json({ ok: true, call_id: recent[0].id, duplicate: true });

        const tail = phoneKey(phone).slice(-4);
        const { data: cands } = await admin
          .from("customers")
          .select("id, first_name, last_name, street, house_no, zip, city, phone, phone2")
          .or(`phone.ilike.%${tail}%,phone2.ilike.%${tail}%`)
          .limit(500);
        const c = (cands ?? []).find((x: any) => phonesMatch(x.phone, phone) || phonesMatch(x.phone2, phone));

        const { data: row, error } = await admin
          .from("incoming_calls")
          .insert({
            phone,
            customer_id: c?.id ?? null,
            customer_name: c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : null,
            customer_address: c ? `${[c.street, c.house_no].filter(Boolean).join(" ")}, ${c.zip} ${c.city}` : null,
          })
          .select("id")
          .single();
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ ok: true, call_id: row.id, found: !!c });
      },
    },
  },
});
