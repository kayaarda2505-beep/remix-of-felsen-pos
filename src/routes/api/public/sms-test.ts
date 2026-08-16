import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sms-test")({
  server: {
    handlers: {
      GET: async () => {
        const out: Record<string, unknown> = {
          hasLovableKey: Boolean(process.env["LOVABLE_API_KEY"]),
          hasGatewayKey: Boolean(process.env["GATEWAYAPI_API_KEY"]),
        };
        try {
          const { toMsisdn, sendSms } = await import("@/lib/sms.server");
          const recipient = toMsisdn("0798136929");
          out["recipient"] = recipient;
          if (recipient) await sendSms(recipient, "Piratino Diagnose-SMS");
          out["sent"] = true;
        } catch (e) {
          out["sent"] = false;
          out["error"] = e instanceof Error ? e.message : String(e);
        }
        return new Response(JSON.stringify(out), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
