import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({
  qr_token: z.string().min(4).max(64),
  note: z.string().max(300).optional().nullable(),
});

export const Route = createFileRoute("/api/public/service-call")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: z.infer<typeof Schema>;
        try {
          payload = Schema.parse(await request.json());
        } catch (e: any) {
          return new Response(`Ungültige Daten: ${e?.message ?? ""}`, { status: 400 });
        }

        const { data: table, error: tErr } = await supabaseAdmin
          .from("dining_tables")
          .select("id, name")
          .eq("qr_token", payload.qr_token)
          .maybeSingle();
        if (tErr) return new Response(tErr.message, { status: 500 });
        if (!table) return new Response("QR-Code ungültig", { status: 404 });

        // Dedupe: ignore if same table has an open call within last 60 seconds
        const { data: dup } = await supabaseAdmin
          .from("service_calls")
          .select("id")
          .eq("table_id", table.id)
          .eq("status", "new")
          .gte("created_at", new Date(Date.now() - 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();
        if (dup) return Response.json({ ok: true, duplicate: true });

        const { error: iErr } = await supabaseAdmin.from("service_calls").insert({
          table_id: table.id,
          table_name: table.name,
          note: payload.note ?? null,
          status: "new",
        });
        if (iErr) return new Response(iErr.message, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
