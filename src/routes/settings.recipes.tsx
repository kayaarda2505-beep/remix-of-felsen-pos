import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, FlaskConical, Search, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SettingsPage } from "@/components/SettingsPage";
import { supabase } from "@/integrations/supabase/client";
import { useProducts, type Product } from "@/hooks/use-products";
import { generateRecipes } from "@/lib/recipes-ai.functions";

export const Route = createFileRoute("/settings/recipes")({
  head: () => ({ meta: [{ title: "Rezepturen — SAINTS POS" }] }),
  component: Recipes,
});

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  stock: number;
  category: string;
}
interface Recipe {
  id: string;
  product_id: string;
  ingredient_id: string;
  amount: number;
}

function Recipes() {
  const qc = useQueryClient();
  const { products, categories } = useProducts();
  const [activeCat, setActiveCat] = useState<string>("Cocktails");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const runAi = useServerFn(generateRecipes);

  const generateAll = async (onlyMissing: boolean) => {
    if (ingredients.length === 0) return toast.error("Keine Zutaten im Lager vorhanden");
    const target = products.filter((p) =>
      onlyMissing ? !(recipesByProduct.get(p.id) ?? []).length : true,
    );
    if (target.length === 0) return toast.info("Alle Produkte haben bereits Rezepte");
    setAiBusy(true);
    const t = toast.loading(`AI generiert Rezepte für ${target.length} Produkte…`);
    try {
      const { recipes: result } = await runAi({
        data: {
          products: target.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            description: p.description ?? null,
            meta: p.meta ?? null,
          })),
          ingredients: ingredients.map((i) => ({
            id: i.id,
            name: i.name,
            unit: i.unit,
            category: i.category,
          })),
        },
      });
      if (result.length === 0) {
        toast.dismiss(t);
        toast.error("AI konnte keine passenden Rezepte erstellen");
        return;
      }
      const affectedIds = result.map((r) => r.product_id);
      const rows = result.flatMap((r) =>
        r.ingredients.map((i) => ({
          product_id: r.product_id,
          ingredient_id: i.ingredient_id,
          amount: i.amount,
        })),
      );
      const deleteResult = await supabase.from("product_recipes").delete().in("product_id", affectedIds);
      toast.dismiss(t);
      if (deleteResult.error) return toast.error(deleteResult.error.message);
      const { error } = await supabase.from("product_recipes").insert(rows);
      if (error) return toast.error(error.message);
      toast.success(`${result.length} Rezepte erstellt`);
      qc.invalidateQueries({ queryKey: ["product_recipes"] });
      qc.invalidateQueries({ queryKey: ["product_recipes", "pos"] });
    } catch (e) {
      toast.dismiss(t);
      toast.error(e instanceof Error ? e.message : "Fehler bei AI-Generierung");
    } finally {
      setAiBusy(false);
    }
  };

  const { data: ingredients = [] } = useQuery<Ingredient[]>({
    queryKey: ["ingredients", "for-recipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingredients")
        .select("id, name, unit, stock, category")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Ingredient[];
    },
  });

  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: ["product_recipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_recipes")
        .select("id, product_id, ingredient_id, amount");
      if (error) throw error;
      return (data ?? []) as Recipe[];
    },
  });

  const recipesByProduct = useMemo(() => {
    const m = new Map<string, Recipe[]>();
    for (const r of recipes) {
      if (!m.has(r.product_id)) m.set(r.product_id, []);
      m.get(r.product_id)!.push(r);
    }
    return m;
  }, [recipes]);

  const visible = useMemo(
    () =>
      products.filter(
        (p) =>
          p.category === activeCat &&
          (search === "" || p.name.toLowerCase().includes(search.toLowerCase())),
      ),
    [activeCat, search],
  );

  const productRecipes = selectedProduct ? recipesByProduct.get(selectedProduct.id) ?? [] : [];

  const addRecipe = async (ingredient_id: string, amount: number) => {
    if (!selectedProduct) return;
    if (amount <= 0) return toast.error("Menge muss > 0 sein");
    const { error } = await supabase
      .from("product_recipes")
      .insert({ product_id: selectedProduct.id, ingredient_id, amount });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["product_recipes"] });
  };

  const updateAmount = async (id: string, amount: number) => {
    if (amount <= 0) return;
    const { error } = await supabase.from("product_recipes").update({ amount }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["product_recipes"] });
  };

  const removeRecipe = async (id: string) => {
    const { error } = await supabase.from("product_recipes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["product_recipes"] });
  };

  return (
    <SettingsPage
      title="Rezepturen"
      subtitle="Verknüpfe Produkte mit Lager-Zutaten — Bestand wird beim Verkauf automatisch abgezogen"
    >
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => generateAll(true)}
          disabled={aiBusy}
          className="rounded-xl bg-accent/20 hover:bg-accent/30 text-accent px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Fehlende Rezepte mit AI generieren
        </button>
        <button
          onClick={() => {
            if (confirm("Alle bestehenden Rezepte überschreiben?")) generateAll(false);
          }}
          disabled={aiBusy}
          className="rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          Alle neu generieren
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 min-h-[60vh]">
        {/* Product picker */}
        <div className="glass rounded-2xl p-4 flex flex-col min-h-0">
          <div className="glass rounded-xl flex items-center gap-2 px-3 py-2 mb-3">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Produkt suchen…"
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeCat === c
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/5 text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 pr-1">
            {visible.map((p) => {
              const has = (recipesByProduct.get(p.id) ?? []).length;
              const active = selectedProduct?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className={`text-left rounded-xl p-3 border-2 transition-all ${
                    active
                      ? "border-accent bg-accent/10"
                      : "border-transparent bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="text-sm font-medium leading-tight">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1.5">
                    <FlaskConical className="w-3 h-3" />
                    {has > 0 ? `${has} Zutat${has > 1 ? "en" : ""}` : "Keine Rezeptur"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recipe editor */}
        <div className="glass rounded-2xl p-5 flex flex-col min-h-0">
          {!selectedProduct ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
              <FlaskConical className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">Produkt links auswählen, um die Rezeptur zu bearbeiten</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Rezeptur für</div>
                <h2 className="text-xl font-semibold">{selectedProduct.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Mengen werden in der Einheit der jeweiligen Zutat angegeben.
                </p>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {productRecipes.length === 0 && (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      Noch keine Zutaten hinterlegt.
                    </div>
                  )}
                  {productRecipes.map((r) => {
                    const ing = ingredients.find((i) => i.id === r.ingredient_id);
                    if (!ing) return null;
                    const possible = ing.stock > 0 ? Math.floor(Number(ing.stock) / Number(r.amount)) : 0;
                    return (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03]"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{ing.name}</div>
                          <div className="text-[11px] text-muted-foreground tabular-nums">
                            Bestand: {Number(ing.stock).toFixed(1)} {ing.unit} · reicht für ~{possible} Drinks
                          </div>
                        </div>
                        <input
                          type="number"
                          step="0.1"
                          min={0.1}
                          defaultValue={r.amount}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== Number(r.amount)) updateAmount(r.id, v);
                          }}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm w-20 text-right tabular-nums outline-none focus:border-accent/50"
                        />
                        <span className="text-xs text-muted-foreground w-8">{ing.unit}</span>
                        <button
                          onClick={() => removeRecipe(r.id)}
                          className="w-8 h-8 rounded-lg hover:bg-destructive/15 hover:text-destructive flex items-center justify-center text-muted-foreground"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <AddIngredientRow
                ingredients={ingredients.filter(
                  (i) => !productRecipes.some((r) => r.ingredient_id === i.id),
                )}
                onAdd={addRecipe}
              />
            </>
          )}
        </div>
      </div>
    </SettingsPage>
  );
}

function AddIngredientRow({
  ingredients,
  onAdd,
}: {
  ingredients: Ingredient[];
  onAdd: (ingredient_id: string, amount: number) => void;
}) {
  const [ingId, setIngId] = useState("");
  const [amount, setAmount] = useState<number>(5);
  const ing = ingredients.find((i) => i.id === ingId);

  return (
    <div className="border-t border-border/40 pt-4 mt-auto">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        Zutat hinzufügen
      </div>
      <div className="flex items-center gap-2">
        <select
          value={ingId}
          onChange={(e) => setIngId(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm flex-1 outline-none focus:border-accent/50"
        >
          <option value="">— Zutat wählen —</option>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.unit})
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.1"
          min={0.1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm w-20 text-right tabular-nums outline-none focus:border-accent/50"
        />
        <span className="text-xs text-muted-foreground w-8">{ing?.unit ?? ""}</span>
        <button
          onClick={() => {
            if (!ingId) return toast.error("Zutat wählen");
            onAdd(ingId, amount);
            setIngId("");
            setAmount(5);
          }}
          className="rounded-lg bg-accent/20 hover:bg-accent/30 text-accent px-3 py-2 text-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Hinzufügen
        </button>
      </div>
    </div>
  );
}
