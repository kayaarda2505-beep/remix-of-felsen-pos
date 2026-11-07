import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { billItemView } from "./receipt";

describe("Kundenquittung Positionen", () => {
  it("Mittagsmenü kurz: Menü Pizza, darunter Gericht, Sosse, Getränk", () => {
    const v = billItemView({ product_name: "Mittagsmenü Pizza", category: "Mittagsmenü", modifiers: ["Margherita - 32cm", "French", "Cola (+CHF 0.00)"], note: null });
    expect(v.name).toBe("Menü Pizza");
    expect(v.details).toEqual(["Margherita", "French", "Cola"]);
  });

  it("Keine Zutatenliste, Änderung nicht doppelt als Notiz", () => {
    const v = billItemView({ product_name: "Pizza Tre Formaggi - 32cm", category: "Pizza", modifiers: ["+ Artischocken", "+ Mascarpone", "+ Oliven"], note: "+ Artischocken · + Mascarpone · + Oliven" });
    expect(v.details).toEqual(["+ Artischocken, + Mascarpone, + Oliven"]);
    expect(v.note).toBeNull();
  });

  it("Echte Notiz bleibt drauf", () => {
    const v = billItemView({ product_name: "Pizza Margherita", category: "Pizza", modifiers: [], note: "gut durch" });
    expect(v.note).toBe("gut durch");
  });
});

import { buildBill } from "./receipt";

describe("Kundenquittung Layout", () => {
  const bill = () =>
    buildBill({
      tableName: "Lieferung",
      total: 33,
      items: [{ product_name: "Pizza Tre Formaggi - 32cm", category: "Pizza", qty: 1, unit_price: 33, modifiers: ["+ Oliven"], note: null } as never],
      deliveryRecipient: { name: "Vidal Silvia", street: "Saumackerstrasse 78", postal: "8048 Zürich", phone: "0766050820" },
    }).lines as Array<{ text?: string; cols?: string[]; bold?: boolean }>;

  it("Kein Leerabstand zwischen Tel. und Tisch", () => {
    const l = bill();
    const i = l.findIndex((x) => x.text?.startsWith("Tel."));
    expect(l[i + 1].cols?.[0]).toBe("Tisch");
  });

  it("Extra-Zutaten fett", () => {
    const line = bill().find((x) => x.text?.includes("+ Oliven"));
    expect(line?.bold).toBe(true);
  });
});
