import { describe, expect, it } from "vitest";
import { normalizeVatLines, snapSwissRate, vatFromGross, vatTotal } from "./swiss-vat";

describe("Schweizer MwSt", () => {
  it("akzeptiert nur Schweizer Sätze – 10.02 % wird verworfen", () => {
    expect(snapSwissRate(8.1)).toBe(8.1);
    expect(snapSwissRate("2,6")).toBe(2.6);
    expect(snapSwissRate(10.02)).toBeNull();
    expect(snapSwissRate(19)).toBeNull();
  });

  it("führt 8.1 % und 2.6 % auf einem Beleg separat", () => {
    const lines = normalizeVatLines([
      { rate: 2.6, gross_amount: 320, vat_amount: 8.11 },
      { rate: 8.1, gross_amount: 39.45, vat_amount: 2.96 },
    ]);
    expect(lines).toEqual([
      { rate: 8.1, gross: 39.45, vat: 2.96 },
      { rate: 2.6, gross: 320, vat: 8.11 },
    ]);
    expect(vatTotal(lines)).toBe(11.07);
  });

  it("berechnet die MwSt pro Satz aus dem Betrag inkl. MwSt", () => {
    expect(vatFromGross(108.1, 8.1)).toBe(8.1);
    expect(vatFromGross(102.6, 2.6)).toBe(2.6);
    expect(normalizeVatLines([{ rate: 2.6, gross_amount: 102.6 }])).toEqual([{ rate: 2.6, gross: 102.6, vat: 2.6 }]);
  });

  it("verwirft Zeilen mit unbekanntem Satz statt sie zu raten", () => {
    expect(normalizeVatLines([{ rate: 10.02, vat_amount: 10.02 }])).toEqual([]);
  });
});
