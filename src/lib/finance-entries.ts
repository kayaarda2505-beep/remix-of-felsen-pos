export const REVENUE_SOURCES = [
  { value: "website", label: "Website" },
  { value: "phone_courier", label: "Telefonkurier" },
  { value: "restaurant", label: "Restaurant" },
  { value: "just_eat", label: "Just Eat" },
  { value: "uber_eats", label: "Uber Eats" },
  { value: "takeaway", label: "Take Away" },
] as const;

export type RevenueSource = typeof REVENUE_SOURCES[number]["value"];

export const EXPENSE_CATEGORIES = [
  "Mietaufwand", "Einkauf", "Getränke", "Lebensmittel", "Lohnaufwand",
  "Sozialversicherungen", "Strom/Wasser/Gas", "Reinigung", "Reparatur",
  "Versicherungen", "Marketing", "Büro", "Transport", "Telefon/Internet",
  "Gebühren/Provisionen", "Leasing", "Steuern/Abgaben", "Sonstiges",
] as const;

export function expenseCategory(category: string): string {
  const aliases: Record<string, string> = {
    Miete: "Mietaufwand", Wareneinkauf: "Einkauf", Personal: "Lohnaufwand",
    "Strom/Wasser": "Strom/Wasser/Gas",
  };
  return aliases[category] ?? category;
}

export function filterExpenses<T extends { category: string }>(entries: T[], category: string): T[] {
  return category === "all" ? entries : entries.filter((e) => expenseCategory(e.category) === category);
}

export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function revenuePayload(input: { revenue_date: string; amount: string; source: string; note: string }) {
  const amount = Number(input.amount.trim().replace(",", "."));
  if (!input.amount.trim() || !Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99) {
    throw new Error("Bitte einen gültigen Betrag grösser als 0 eingeben.");
  }
  const date = new Date(`${input.revenue_date}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.revenue_date) || Number.isNaN(date.getTime()) || localDate(date) !== input.revenue_date) {
    throw new Error("Bitte ein gültiges Datum eingeben.");
  }
  const source = REVENUE_SOURCES.find((s) => s.value === input.source);
  if (!source) throw new Error("Bitte die Umsatzherkunft auswählen.");
  return { revenue_date: input.revenue_date, amount: Math.round(amount * 100) / 100, source: source.value, note: input.note.trim() || null };
}