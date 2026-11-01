import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WeeklyDish = { name: string; description: string; price: string };

const InputSchema = z.object({ imageDataUrl: z.string().min(20).max(15_000_000) });

export const extractWeeklyMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; dishes?: WeeklyDish[]; error?: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, error: "AI nicht konfiguriert" };

    const system = `Du liest handschriftliche Wochenmenü-Notizen einer italienischen Pizzeria in der Schweiz (Piratino) und machst daraus eine elegante Speisekarte.
Regeln:
- Jedes Gericht wird ein Eintrag. Mengenangaben wie "1x" weglassen.
- Rechtschreibung korrigieren und gastronomisch schön formulieren (z.B. "Zahnder Filet mit Rosmarin Kartoffeln" -> name "Zanderfilet", description "an Rosmarinkartoffeln"; "Entrecote Grill + Gemüse + Pataten" -> name "Entrecôte vom Grill", description "mit Grillgemüse und Patate").
- name: kurzer Hauptname des Gerichts (italienische Namen beibehalten, z.B. "Lasagne Bolognese", "Penne Verdura").
- description: eine kurze, elegante Beilagen-/Zubereitungszeile auf Deutsch, nichts erfinden was nicht sinngemäss dasteht, ausser eine dezente passende Ergänzung (max. 8 Wörter).
- price: nur wenn im Foto ein Preis steht, als Zahl z.B. "24.50", sonst leer.
- Überschriften wie "Wochen Menü" sind keine Gerichte.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Lovable-API-Key": apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: system,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Lies die Gerichte aus diesen Notizen." },
              { type: "input_image", image_url: data.imageDataUrl },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "menu",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["dishes"],
              properties: {
                dishes: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["name", "description", "price"],
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      price: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });

    if (!resp.ok || !resp.body) {
      const txt = await resp.text().catch(() => "");
      if (resp.status === 429) return { ok: false, error: "Zu viele Anfragen – kurz warten." };
      if (resp.status === 402) return { ok: false, error: "AI-Guthaben verbraucht." };
      return { ok: false, error: `Fehler ${resp.status}: ${txt.slice(0, 200)}` };
    }
    // SSE lesen
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let args = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "response.output_text.delta") args += ev.delta ?? "";
          if (ev.type === "response.failed" || ev.type === "error")
            return { ok: false, error: ev?.response?.error?.message ?? ev?.message ?? "AI Fehler" };
        } catch {
          /* ignore */
        }
      }
    }
    if (!args) return { ok: false, error: "Keine Gerichte erkannt" };
    try {
      const parsed = JSON.parse(args) as { dishes?: Partial<WeeklyDish>[] };
      const dishes = (parsed.dishes ?? [])
        .filter((d) => d?.name)
        .map((d) => ({
          name: String(d.name).trim(),
          description: String(d.description ?? "").trim(),
          price: String(d.price ?? "").trim(),
        }));
      if (!dishes.length) return { ok: false, error: "Keine Gerichte erkannt" };
      return { ok: true, dishes };
    } catch {
      return { ok: false, error: "Antwort nicht lesbar" };
    }
  });
