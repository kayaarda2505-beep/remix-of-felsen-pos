import { describe, expect, test } from "vitest";
import { expenseCategory, filterExpenses, localDate, revenuePayload } from "./finance-entries";

describe("Manuelle Umsätze", () => {
  for (const source of ["website", "phone_courier", "restaurant", "just_eat", "uber_eats", "takeaway"]) {
    test(`speichert Herkunft ${source}`, () => {
      expect(revenuePayload({ revenue_date: "2026-11-21", amount: "125,50", source, note: " Tagesumsatz " })).toEqual({
        revenue_date: "2026-11-21", amount: 125.5, source, note: "Tagesumsatz",
      });
    });
  }
  test("verhindert ungültige Beträge und fehlende Herkunft", () => {
    for (const amount of ["", "-1", "0", "Infinity", "abc"]) {
      expect(() => revenuePayload({ revenue_date: "2026-11-21", amount, source: "website", note: "" })).toThrow();
    }
    expect(() => revenuePayload({ revenue_date: "2026-11-21", amount: "10", source: "", note: "" })).toThrow();
  });
  test("verhindert ungültige Datumswerte", () => {
    expect(() => revenuePayload({ revenue_date: "2026-02-30", amount: "10", source: "website", note: "" })).toThrow();
  });
});

describe("Ausgabenfilter", () => {
  for (const [category, legacy] of [["Mietaufwand", "Miete"], ["Einkauf", "Wareneinkauf"], ["Lohnaufwand", "Personal"]]) {
    test(`filtert ${category} einschliesslich bestehender Einträge`, () => {
      const entries = [{ category: legacy ?? "", amount: 200 }, { category: category ?? "", amount: 100 }, { category: "Sonstiges", amount: 50 }];
      expect(filterExpenses(entries, category ?? "").map((e) => e.amount)).toEqual([200, 100]);
      expect(entries[0]?.category).toBe(legacy);
      expect(expenseCategory(legacy ?? "")).toBe(category);
    });
  }
  test("alle Kategorien behalten alle Ausgaben", () => {
    expect(filterExpenses([{ category: "Miete" }, { category: "Reinigung" }], "all")).toHaveLength(2);
  });
  test("Monatsgrenzen verwenden das lokale Datum ohne UTC-Verschiebung", () => {
    expect(localDate(new Date(2026, 10, 1, 0, 0))).toBe("2026-11-01");
    expect(localDate(new Date(2026, 10, 30, 0, 0))).toBe("2026-11-30");
  });
});