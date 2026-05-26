import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  imageDataUrl: z.string().min(20).max(15_000_000), // data:image/jpeg;base64,...
});

export type ExtractedExpense = {
  vendor: string | null;
  expense_date: string | null; // YYYY-MM-DD
  amount: number | null;
  vat_amount: number | null;
  currency: string;
  category: string;
  description: string | null;
  payment_method: string | null;
};

export const extractReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; result?: ExtractedExpense; error?: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, error: "AI nicht konfiguriert" };

    const system = `Du extrahierst Daten aus einem Kassenbon/Quittung-Foto. Antworte NUR mit dem Tool-Call.
Regeln:
- amount = Gesamtbetrag inkl. MwSt. als Zahl (z.B. 42.50, nicht "42.50 CHF")
- expense_date im Format YYYY-MM-DD, wenn nicht erkennbar lass leer
- vat_amount = MwSt-Betrag wenn ersichtlich
- category aus: Wareneinkauf, Getränke, Lebensmittel, Reinigung, Reparatur, Miete, Strom/Wasser, Marketing, Büro, Transport, Personal, Sonstiges
- payment_method: Bar, Karte, Twint, Rechnung, oder null
- description = 1-2 Zeilen was gekauft wurde (z.B. "Vodka 70cl, Tonic Water 6x")
- vendor = Firma/Laden Name
- currency Standard CHF`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: "Extrahiere die Daten aus diesem Beleg." },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_expense",
            description: "Speichert die extrahierten Belegdaten",
            parameters: {
              type: "object",
              properties: {
                vendor: { type: "string" },
                expense_date: { type: "string" },
                amount: { type: "number" },
                vat_amount: { type: "number" },
                currency: { type: "string" },
                category: { type: "string" },
                description: { type: "string" },
                payment_method: { type: "string" },
              },
              required: ["amount", "category"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_expense" } },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      if (resp.status === 429) return { ok: false, error: "AI Rate-Limit – kurz warten." };
      if (resp.status === 402) return { ok: false, error: "AI-Guthaben verbraucht." };
      return { ok: false, error: `AI Fehler ${resp.status}: ${txt.slice(0, 200)}` };
    }

    const json = await resp.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) return { ok: false, error: "Keine Daten erkannt" };

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      return { ok: false, error: "Antwort nicht lesbar" };
    }

    const result: ExtractedExpense = {
      vendor: typeof parsed.vendor === "string" ? parsed.vendor : null,
      expense_date: typeof parsed.expense_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.expense_date) ? parsed.expense_date : null,
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      vat_amount: typeof parsed.vat_amount === "number" ? parsed.vat_amount : null,
      currency: typeof parsed.currency === "string" ? parsed.currency : "CHF",
      category: typeof parsed.category === "string" ? parsed.category : "Sonstiges",
      description: typeof parsed.description === "string" ? parsed.description : null,
      payment_method: typeof parsed.payment_method === "string" ? parsed.payment_method : null,
    };
    return { ok: true, result };
  });
