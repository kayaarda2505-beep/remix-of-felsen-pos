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
