import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const Schema = z.object({
  qr_token: z.string().min(4).max(64),
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().max(200).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  spotify_uri: z.string().trim().max(120).optional().nullable(),
  spotify_track_id: z.string().trim().max(60).optional().nullable(),
  image_url: z.string().trim().url().max(500).optional().nullable(),
});

export const Route = createFileRoute("/api/public/song-request")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        try {
          const body = Schema.parse(await request.json());

          const { data: table } = await supabaseAdmin
            .from("dining_tables")
            .select("id, name")
            .eq("qr_token", body.qr_token)
            .maybeSingle();

          if (!table) {
            return new Response(JSON.stringify({ error: "Invalid QR token" }), {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const { error } = await supabaseAdmin.from("song_requests").insert({
            table_id: table.id,
            table_name: table.name,
            title: body.title,
            artist: body.artist ?? null,
            note: body.note ?? null,
            spotify_uri: body.spotify_uri ?? null,
            spotify_track_id: body.spotify_track_id ?? null,
            image_url: body.image_url ?? null,
          });

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Invalid request";
          return new Response(JSON.stringify({ error: msg }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
