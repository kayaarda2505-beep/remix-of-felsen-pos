import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/table/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String(params.token ?? "");
        if (token.length < 4 || token.length > 64) {
          return new Response("Ungültiger Token", { status: 400 });
        }
        const { data, error } = await supabaseAdmin
          .from("dining_tables")
          .select("id, name, seats, area")
          .eq("qr_token", token)
          .maybeSingle();
        if (error) return new Response(error.message, { status: 500 });
        if (!data) return new Response("QR-Code ungültig", { status: 404 });
        return Response.json({ table: data });
      },
    },
  },
});
