import { describe, expect, it } from "vitest";
import { adjustPayments, planReceiptEdit, type EditLine } from "./receipt-edit";

const line = (p: Partial<EditLine>): EditLine => ({
  product_id: "p", product_name: "Pizza", category: "Pizza", unit_price: 18, qty: 1, modifiers: [], note: null, ...p,
});

describe("Beleg bearbeiten", () => {
  it("Artikel hinzufügen erhöht das Total um den Artikelpreis", () => {
    const orig = [line({ id: "a", unit_price: 26.5 })];
    const plan = planReceiptEdit(orig, [...orig, line({ product_name: "Cola", unit_price: 4.5 })]);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.newSubtotal).toBe(31);
    expect(plan.delta).toBe(4.5);
  });

  it("Artikel entfernen löscht die Position und senkt das Total", () => {
    const orig = [line({ id: "a", unit_price: 26.5 }), line({ id: "b", unit_price: 33 })];
    const plan = planReceiptEdit(orig, [orig[0]]);
    expect(plan.deleteIds).toEqual(["b"]);
    expect(plan.delta).toBe(-33);
  });

  it("Menge ändern wird als Update gespeichert", () => {
    const orig = [line({ id: "a", unit_price: 15, qty: 1 })];
    const plan = planReceiptEdit(orig, [{ ...orig[0], qty: 3 }]);
    expect(plan.updates).toEqual([{ id: "a", qty: 3, note: null }]);
    expect(plan.delta).toBe(30);
  });

  it("Zahlung wird um die Differenz angepasst, nie unter 0", () => {
    expect(adjustPayments([{ id: "x", amount: 59.5 }], -33)).toEqual([{ id: "x", amount: 26.5 }]);
    expect(adjustPayments([{ id: "x", amount: 10 }, { id: "y", amount: 5 }], -8)).toEqual([
      { id: "y", amount: 0 },
      { id: "x", amount: 7 },
    ]);
  });
});
