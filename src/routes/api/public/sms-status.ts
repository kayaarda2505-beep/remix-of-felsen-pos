import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sms-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = (await request.json()) as any;
          const ev = payload?.event ?? {};
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await (supabaseAdmin as any).from("sms_events").insert({
            msg_id: ev.msg_id ?? null,
            recipient: ev.recipient != null ? String(ev.recipient) : null,
            reference: ev.reference ?? null,
            status: ev.status ?? null,
            error_code: ev.error?.hex_code ?? null,
            error_details: ev.error?.details ?? null,
            raw: payload,
          });
          return new Response("ok");
        } catch (e) {
          console.error("[sms-status]", e);
          return new Response("error", { status: 200 });
        }
      },
    },
  },
});
