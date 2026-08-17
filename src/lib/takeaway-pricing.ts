/**
 * Takeaway-Preise (Abholung):
 * - Pizza 32cm: Margherita CHF 15, alle anderen CHF 18
 * - Pizza Grande 45cm: Margherita CHF 30, alle anderen CHF 35
 * - Pasta: immer CHF 18
 * Alle übrigen Kategorien behalten den regulären Preis.
 */
export function takeawayPrice(
  product: { name: string; category: string; price: number },
): number {
  const cat = product.category.toLowerCase();
  const isMargherita = /margh/i.test(product.name);

  if (cat.includes("pizza")) {
    const isGrande = cat.includes("45") || /45\s*cm/i.test(product.name);
    if (cat.includes("kinder")) return product.price;
    if (isGrande) return isMargherita ? 30 : 35;
    return isMargherita ? 15 : 18;
  }

  if (cat.includes("pasta")) return 18;

  return product.price;
}

export function effectiveBasePrice(
  product: { name: string; category: string; price: number },
  takeaway: boolean,
): number {
  return takeaway ? takeawayPrice(product) : product.price;
}
