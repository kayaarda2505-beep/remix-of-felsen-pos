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
              { type: "text", text: "Lies die Gerichte aus diesen Notizen." },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_menu",
              description: "Speichert die Gerichte",
              parameters: {
                type: "object",
                properties: {
                  dishes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                        price: { type: "string" },
                      },
                      required: ["name"],
                    },
                  },
                },
                required: ["dishes"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_menu" } },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      if (resp.status === 429) return { ok: false, error: "Zu viele Anfragen – kurz warten." };
      if (resp.status === 402) return { ok: false, error: "AI-Guthaben verbraucht." };
      return { ok: false, error: `Fehler ${resp.status}: ${txt.slice(0, 200)}` };
    }
    const json = await resp.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
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
