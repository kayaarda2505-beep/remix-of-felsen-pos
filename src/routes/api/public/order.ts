import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({
  qr_token: z.string().min(4).max(64),
  items: z
    .array(
      z.object({
        product_id: z.string().min(1).max(64),
        product_name: z.string().min(1).max(200),
        category: z.string().min(1).max(64).nullable().optional(),
        unit_price: z.number().min(0).max(10000),
        qty: z.number().int().min(1).max(99),
        note: z.string().max(500).nullable().optional(),
        modifiers: z.array(z.string().min(1).max(60)).max(20).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export const Route = createFileRoute("/api/public/order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: z.infer<typeof Schema>;
        try {
          payload = Schema.parse(await request.json());
        } catch (e: any) {
          return new Response(`Ungültige Daten: ${e?.message ?? ""}`, { status: 400 });
        }

        // Resolve table by qr_token (server-side; bypasses client visibility)
        const { data: table, error: tErr } = await supabaseAdmin
          .from("dining_tables")
          .select("id, location_id, status")
          .eq("qr_token", payload.qr_token)
          .maybeSingle();
        if (tErr) return new Response(tErr.message, { status: 500 });
        if (!table) return new Response("QR-Code ungültig", { status: 404 });

        // Find an existing open order for this table or create one
        const { data: existing } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("table_id", table.id)
          .eq("status", "open")
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let orderId = existing?.id as string | undefined;

        if (!orderId) {
          const { data: created, error: cErr } = await supabaseAdmin
            .from("orders")
            .insert({
              table_id: table.id,
              location_id: table.location_id,
              status: "open",
              opened_by_name: "Gast",
              guests: 1,
            })
            .select("id")
            .single();
          if (cErr || !created) return new Response(cErr?.message ?? "Order failed", { status: 500 });
          orderId = created.id;

          // Mark table as occupied if it was free
          await supabaseAdmin
            .from("dining_tables")
            .update({ status: "occupied", opened_at: new Date().toISOString(), guests: 1 })
            .eq("id", table.id)
            .eq("status", "free");
        }

        const rows = payload.items.map((it) => ({
          order_id: orderId!,
          product_id: it.product_id,
          product_name: it.product_name,
          category: it.category ?? null,
          unit_price: it.unit_price,
          qty: it.qty,
          note: it.note ?? null,
          modifiers: it.modifiers ?? [],
        }));

        const { error: iErr } = await supabaseAdmin.from("order_items").insert(rows);
        if (iErr) return new Response(iErr.message, { status: 500 });

        return Response.json({ ok: true, order_id: orderId });
      },
    },
  },
});
