import { describe, expect, it } from "vitest";
import { weeklyValid } from "./use-products";

describe("Wochenmenü nur in seiner Woche sichtbar", () => {
  const meta = "weekly:2026-11-02:2026-11-08";
  it("sichtbar innerhalb der Woche", () => expect(weeklyValid(meta, "2026-11-08")).toBe(true));
  it("weg nach Wochenende", () => expect(weeklyValid(meta, "2026-11-09")).toBe(false));
  it("noch nicht vor Wochenbeginn", () => expect(weeklyValid(meta, "2026-11-01")).toBe(false));
  it("normale Produkte unberührt", () => expect(weeklyValid(null, "2026-11-09")).toBe(true));
});
