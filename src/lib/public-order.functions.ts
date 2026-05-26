import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const QrTableSchema = z.object({
  token: z.string().min(4).max(64),
});

export const getQrTable = createServerFn({ method: "GET" })
  .inputValidator((input) => QrTableSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: table, error } = await supabaseAdmin
      .from("dining_tables")
      .select("id, name, seats, area")
      .eq("qr_token", data.token)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return { table };
  });