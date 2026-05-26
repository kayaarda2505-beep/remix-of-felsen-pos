type ProductInput = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  meta?: string | null;
};

type IngredientInput = {
  id: string;
  name: string;
  unit: string;
  category: string;
};

type RecipeOutput = {
  product_id: string;
  ingredients: { ingredient_id: string; amount: number }[];
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss");

const amountFor = (product: ProductInput, ingredient: IngredientInput) => {
  const category = normalize(product.category);
  const name = normalize(product.name);
  const meta = normalize(product.meta ?? "");
  const ing = normalize(`${ingredient.name} ${ingredient.category} ${ingredient.unit}`);

  if (category === "bier") {
    if (ing.includes("fass")) return meta.includes("50cl") ? 0.5 : 0.3;
    return 1;
  }
  if (category === "softdrinks") return 1;
  if (category === "wein") {
    if (ing.includes("flasche")) return 0.13;
    return 10;
  }
  if (category === "shots") return ing.includes("cl") ? 4 : 1;
  if (category === "spirituosen") return ing.includes("cl") ? 8 : 1;
  if (category === "hot") {
    if (ing.includes("kaffeebohnen")) return name.includes("espresso") ? 0.007 : 0.01;
    if (ing.includes("vollmilch")) return name.includes("cappuccino") || name.includes("latte") || name.includes("schale") ? 0.12 : 0.03;
    return 1;
  }
  if (category === "snacks") {
    if (ing.includes("olivenol")) return 0.02;
    if (ing.includes("knoblauch")) return 0.01;
    if (ing.includes("kg")) return 0.08;
    return 1;
  }
  if (ing.includes("prosecco")) return category === "spritz" ? 8 : 10;
  if (ing.includes("soda")) return category === "spritz" ? 4 : 8;
  if (ing.includes("sprite") || ing.includes("tonic") || ing.includes("bitter lemon") || ing.includes("ginger") || ing.includes("wild berry")) return 1;
  if (ing.includes("saft") || ing.includes("sirup") || ing.includes("kahlua") || ing.includes("campari") || ing.includes("wermut") || ing.includes("baileys")) return 2;
  if (ing.includes("aperol") || ing.includes("limoncello") || ing.includes("lillet") || ing.includes("amaretto")) return 4;
  if (ing.includes("gin") || ing.includes("rum") || ing.includes("vodka") || ing.includes("tequila") || ing.includes("whiskey")) return 5;
  if (ing.includes("eiweiss")) return 2;
  if (ing.includes("zucker") && ing.includes("kg")) return 0.01;
  if (ing.includes("limetten") || ing.includes("zitronen")) return 0.5;
  if (ing.includes("orangen")) return 0.15;
  if (ing.includes("minze") || ing.includes("basilikum")) return 0.08;
  if (ing.includes("schale")) return 0.1;
  if (ing.includes("eiswurfel")) return 0.15;
  return 1;
};

export function buildFallbackRecipes(products: ProductInput[], ingredients: IngredientInput[]): RecipeOutput[] {
  const normalizedIngredients = ingredients.map((ingredient) => ({
    ingredient,
    normalized: normalize(`${ingredient.name} ${ingredient.category}`),
  }));

  return products
    .map((product) => {
      const haystack = normalize(`${product.name} ${product.description ?? ""} ${product.meta ?? ""}`);
      const used = new Set<string>();
      const matched = normalizedIngredients
        .map(({ ingredient, normalized }) => {
          const words = normalized.split(/[^a-z0-9]+/).filter((word) => word.length >= 4);
          const nameHit = words.some((word) => haystack.includes(word));
          const allowedCategoryFallback = ["hot", "kaffee"].includes(normalize(product.category)) && normalize(ingredient.category) === "kaffee";
          const exactHit = haystack.includes(normalize(ingredient.name).replace(/\s*(33cl|50cl|75cl)$/i, ""));
          const score = (exactHit ? 100 : 0) + (nameHit ? 40 : 0) + (allowedCategoryFallback ? 8 : 0);
          return { ingredient, score };
        })
        .filter(({ ingredient, score }) => {
          if (score <= 0 || used.has(ingredient.id)) return false;
          used.add(ingredient.id);
          return true;
        })
        .sort((a, b) => b.score - a.score);

      const fallback = normalizedIngredients.filter(({ normalized }) => {
        const category = normalize(product.category);
        if (matched.length > 0) return false;
        if (category === "signatures") return /gin|vodka|rum|zitrone|limette|sirup|soda|eiswurfel/.test(normalized);
        if (category === "snacks") return /snacks|tomaten|avocado|oliven|brot|parmesan|olivenol|knoblauch/.test(normalized);
        if (category === "hot") return /kaffee|kaffeebohnen|vollmilch|tee/.test(normalized);
        return false;
      });

      const limited = (matched.length > 0 ? matched : fallback).slice(0, normalize(product.category) === "snacks" ? 6 : 5);
      return {
        product_id: product.id,
        ingredients: limited.map(({ ingredient }) => ({
          ingredient_id: ingredient.id,
          amount: amountFor(product, ingredient),
        })),
      };
    })
    .filter((recipe) => recipe.ingredients.length > 0);
}