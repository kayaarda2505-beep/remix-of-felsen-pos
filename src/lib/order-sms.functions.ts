import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { notify } from "./order-sms.server";

const ReceivedSchema = z.object({
  orderId: z.string().uuid(),
  etaMinutes: z.number().int().min(5).max(180).optional(),
});
const IdSchema = z.object({ orderId: z.string().uuid() });

export const sendOrderReceivedSms = createServerFn({ method: "POST" })
  .inputValidator((input) => ReceivedSchema.parse(input))
  .handler(async ({ data }) => notify(data.orderId, "received", data.etaMinutes));

export const sendOrderReadySms = createServerFn({ method: "POST" })
  .inputValidator((input) => IdSchema.parse(input))
  .handler(async ({ data }) => notify(data.orderId, "ready"));
