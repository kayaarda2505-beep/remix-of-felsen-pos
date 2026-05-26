import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({
  qr_token: z.string().min(4).max(64),
  method: z.enum(["cash", "card_terminal", "stripe"]),
  note: z.string().max(300).optional().nullable(),
});

export const Route = createFileRoute("/api/public/payment-request")({
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

        const { data: openOrder } = await supabaseAdmin
          .from("orders")
          .select("id, total")
          .eq("table_id", table.id)
          .eq("status", "open")
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Avoid duplicate "new" requests for the same table in last 2 minutes
        const { data: dup } = await supabaseAdmin
          .from("payment_requests")
          .select("id")
          .eq("table_id", table.id)
          .eq("status", "new")
          .gte("created_at", new Date(Date.now() - 2 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();

        if (dup) {
          return Response.json({ ok: true, duplicate: true, id: dup.id });
        }

        const { data: inserted, error: iErr } = await supabaseAdmin
          .from("payment_requests")
          .insert({
            table_id: table.id,
            table_name: table.name,
            order_id: openOrder?.id ?? null,
            amount: openOrder?.total ?? 0,
            method: payload.method,
            status: "new",
            note: payload.note ?? null,
          })
          .select("id")
          .single();

        if (iErr || !inserted) return new Response(iErr?.message ?? "Fehler", { status: 500 });
        return Response.json({ ok: true, id: inserted.id });
      },
    },
  },
});
