/**
 * Pizzabeilagen (Extra-Zutaten), die auf jede Pizza zusätzlich bestellt werden können.
 * Preise gelten für 32cm; grössere Pizzen werden über den Grössen-Faktor berechnet.
 */
export interface PizzaTopping {
  id: string;
  name: string;
  /** Aufpreis in CHF für eine 32cm Pizza */
  price: number;
}

export const PIZZA_TOPPINGS: PizzaTopping[] = [
  { id: "top-ananas", name: "Ananas", price: 2.5 },
  { id: "top-artischocken", name: "Artischocken", price: 3 },
  { id: "top-auberginen", name: "Auberginen", price: 3 },
  { id: "top-champignons", name: "Champignons", price: 3 },
  { id: "top-cherrytomaten", name: "Cherrytomaten", price: 3 },
  { id: "top-crevetten", name: "Crevetten", price: 5 },
  { id: "top-ei", name: "Ei", price: 2.5 },
  { id: "top-gorgonzola", name: "Gorgonzola", price: 3.5 },
  { id: "top-hackfleisch", name: "Hackfleisch", price: 4.5 },
  { id: "top-kapern", name: "Kapern", price: 2.5 },
  { id: "top-kebabfleisch", name: "Kebabfleisch", price: 5 },
  { id: "top-knoblauch", name: "Knoblauch", price: 2 },
  { id: "top-mais", name: "Mais", price: 2.5 },
  { id: "top-mascarpone", name: "Mascarpone", price: 3.5 },
  { id: "top-meeresfruechte", name: "Meeresfrüchte", price: 5 },
  { id: "top-mozzarella", name: "Extra Mozzarella", price: 3 },
  { id: "top-oliven", name: "Oliven", price: 2.5 },
  { id: "top-parmesan", name: "Parmesan", price: 3 },
  { id: "top-peperoncini", name: "Peperoncini", price: 2 },
  { id: "top-peperoni", name: "Peperoni", price: 2.5 },
  { id: "top-pesto", name: "Pesto", price: 2.5 },
  { id: "top-poulet", name: "Pouletgeschnetzeltes", price: 5 },
  { id: "top-rohschinken", name: "Rohschinken", price: 5 },
  { id: "top-rucola", name: "Rucola", price: 3 },
  { id: "top-salami", name: "Salami", price: 4 },
  { id: "top-salami-scharf", name: "Scharfe Salami", price: 4 },
  { id: "top-sardellen", name: "Sardellen", price: 3.5 },
  { id: "top-schinken", name: "Schinken", price: 4 },
  { id: "top-speck", name: "Speck", price: 4 },
  { id: "top-spinat", name: "Spinat", price: 3 },
  { id: "top-steinpilze", name: "Steinpilze", price: 4.5 },
  { id: "top-thon", name: "Thon", price: 4 },
  { id: "top-zwiebeln", name: "Zwiebeln", price: 2 },
];

/** Erkennt, ob ein Artikel eine Pizza ist (Name oder Kategorie). */
export function isPizzaItem(name: string, category?: string | null): boolean {
  return /pizza|calzone/i.test(`${category ?? ""} ${name}`);
}

/** Aufpreis-Faktor je nach Pizzagrösse (32cm = 1x, 45cm = 1.8x, 50cm = 2x). */
export function toppingSizeFactor(name: string, category?: string | null): number {
  const s = `${category ?? ""} ${name}`;
  if (/50\s*cm/i.test(s)) return 2;
  if (/45\s*cm/i.test(s)) return 1.8;
  return 1;
}

/** Effektiver Aufpreis einer Zutat für den konkreten Artikel. */
export function toppingPrice(t: PizzaTopping, name: string, category?: string | null): number {
  return +(t.price * toppingSizeFactor(name, category)).toFixed(2);
}
