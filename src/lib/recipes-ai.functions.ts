import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildFallbackRecipes } from "./recipes-ai.server";

const InputSchema = z.object({
  products: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        category: z.string(),
        description: z.string().optional().nullable(),
        meta: z.string().optional().nullable(),
      }),
    )
    .min(1)
    .max(200),
  ingredients: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        unit: z.string(),
        category: z.string(),
      }),
    )
    .min(1)
    .max(500),
});

export const generateRecipes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { recipes: buildFallbackRecipes(data.products, data.ingredients) };

    const systemPrompt = `Du bist Barkeeper und Rezeptur-Experte. Erstelle für jedes übergebene Produkt eine realistische Rezeptur in den standard Schweizer Bar-Mengen.
Regeln:
- Verwende AUSSCHLIESSLICH die übergebenen Zutat-IDs. Erfinde keine.
- Mengen sind in der Einheit der jeweiligen Zutat (cl, ml, g, stk, dash).
- Typische Cocktails: 4-6cl Spirit, 1-2cl Likör, 2cl Saft/Sirup, etc.
- Bier/Wein/Softdrinks: 1 Einheit der entsprechenden Zutat (z.B. 1 Flasche = 1 stk, oder 33cl).
- Wenn KEINE passende Zutat existiert, lasse das Produkt komplett aus der Antwort weg.
- Keine doppelten ingredient_id pro Produkt.`;

    const userPrompt = `INGREDIENTS:\n${JSON.stringify(data.ingredients)}\n\nPRODUCTS:\n${JSON.stringify(data.products)}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_recipes",
              description: "Rezepturen für alle Produkte speichern",
              parameters: {
                type: "object",
                properties: {
                  recipes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        product_id: { type: "string" },
                        ingredients: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              ingredient_id: { type: "string" },
                              amount: { type: "number" },
                            },
                            required: ["ingredient_id", "amount"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["product_id", "ingredients"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["recipes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_recipes" } },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      if (resp.status === 429 || resp.status === 402) {
        return { recipes: buildFallbackRecipes(data.products, data.ingredients) };
      }
      throw new Error(`AI-Fehler: ${text}`);
    }

    const json = await resp.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("AI hat keine Rezepte zurückgegeben");
    const parsed = JSON.parse(call.function.arguments) as {
      recipes: { product_id: string; ingredients: { ingredient_id: string; amount: number }[] }[];
    };

    // Validate against known ids
    const validIngredients = new Set(data.ingredients.map((i) => i.id));
    const validProducts = new Set(data.products.map((p) => p.id));
    const seenByProduct = new Map<string, Set<string>>();
    const clean = parsed.recipes
      .filter((r) => validProducts.has(r.product_id))
      .map((r) => ({
        product_id: r.product_id,
        ingredients: r.ingredients.filter((i) => {
          if (!validIngredients.has(i.ingredient_id) || i.amount <= 0) return false;
          const seen = seenByProduct.get(r.product_id) ?? new Set<string>();
          if (seen.has(i.ingredient_id)) return false;
          seen.add(i.ingredient_id);
          seenByProduct.set(r.product_id, seen);
          return true;
        }),
      }))
      .filter((r) => r.ingredients.length > 0);

    return { recipes: clean };
  });
