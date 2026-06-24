import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUMUP_BASE = "https://api.sumup.com";

function getConfig() {
  const apiKey = process.env.SUMUP_API_KEY;
  const merchantCode = process.env.SUMUP_MERCHANT_CODE;
  const readerId = process.env.SUMUP_READER_ID;
  if (!apiKey) throw new Error("SUMUP_API_KEY ist nicht konfiguriert");
  if (!merchantCode) throw new Error("SUMUP_MERCHANT_CODE ist nicht konfiguriert");
  if (!readerId) throw new Error("SUMUP_READER_ID ist nicht konfiguriert");
  return { apiKey, merchantCode, readerId };
}

export const sumupListReaders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const apiKey = process.env.SUMUP_API_KEY;
    const merchantCode = process.env.SUMUP_MERCHANT_CODE;
    if (!apiKey) throw new Error("SUMUP_API_KEY fehlt");
    if (!merchantCode) throw new Error("SUMUP_MERCHANT_CODE fehlt");
    const res = await fetch(
      `${SUMUP_BASE}/v0.1/merchants/${merchantCode}/readers`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    const text = await res.text();
    if (!res.ok) throw new Error(`SumUp ${res.status}: ${text.slice(0, 400)}`);
    let json: any = {};
    try { json = JSON.parse(text); } catch {}
    const items = json?.items ?? json ?? [];
    return {
      merchantCode,
      readers: (Array.isArray(items) ? items : []).map((r: any) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        device: r.device?.model ?? r.device?.identifier,
      })),
    };
  });

export const sumupSendToReader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; description?: string; currency?: string }) =>
    z
      .object({
        amount: z.number().positive().max(100000),
        description: z.string().max(120).optional(),
        currency: z.string().length(3).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { apiKey, merchantCode, readerId } = getConfig();
    const currency = data.currency ?? "CHF";
    const minorUnit = 2;
    const value = Math.round(data.amount * 100);

    const res = await fetch(
      `${SUMUP_BASE}/v0.1/merchants/${merchantCode}/readers/${readerId}/checkout`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          total_amount: { value, currency, minor_unit: minorUnit },
          description: data.description ?? "Kasse",
        }),
      },
    );

    const text = await res.text();
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(
          `Reader nicht gefunden (SUMUP_READER_ID=${readerId}). ` +
            `Die Seriennummer ist nicht die Reader-ID; SumUp erwartet eine interne rdr_… ID. ` +
            `Bitte in der Kasse „Reader-ID suchen" öffnen. Wenn dort 0 Reader erscheinen, sieht dieser API-Key den Reader nicht.`,
        );
      }
      throw new Error(`SumUp-Fehler (${res.status}): ${text.slice(0, 300)}`);
    }
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {}
    const clientTxId: string | undefined = json?.data?.client_transaction_id ?? json?.client_transaction_id;
    return { clientTransactionId: clientTxId ?? null };
  });

export const sumupGetTransactionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientTransactionId: string }) =>
    z.object({ clientTransactionId: z.string().min(4).max(128) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { apiKey, merchantCode } = getConfig();
    const url = `${SUMUP_BASE}/v2.1/merchants/${merchantCode}/transactions?client_transaction_id=${encodeURIComponent(
      data.clientTransactionId,
    )}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const text = await res.text();
    if (!res.ok) {
      // 404 = noch keine Transaktion = pending
      if (res.status === 404) return { status: "PENDING" as const };
      throw new Error(`SumUp-Fehler (${res.status}): ${text.slice(0, 300)}`);
    }
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {}
    const items = Array.isArray(json) ? json : json?.items ?? [json];
    const tx = items?.[0];
    const status: string = tx?.status ?? "PENDING";
    return {
      status: status.toUpperCase() as "SUCCESSFUL" | "FAILED" | "CANCELLED" | "PENDING",
      transactionId: tx?.id as string | undefined,
      cardType: tx?.card?.type as string | undefined,
    };
  });
