import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("./printer-bridge", () => ({ printReceipt: vi.fn(async () => ({ ok: true })), getAgentPrinters: vi.fn() }));
import { planStationTickets, printOrderToStations, type ReceiptItem } from "./receipt";
import { printReceipt } from "./printer-bridge";

const kitchen: ReceiptItem = { product_name: "Spaghetti", category: "Pasta", qty: 2, unit_price: 18 };
const pizza: ReceiptItem = { product_name: "Margherita", category: "Pizza", qty: 1, unit_price: 20 };
const at = (time: string) => new Date(`2026-11-19T${time}+01:00`);
afterEach(() => vi.clearAllMocks());

describe("Stationskoordination", () => {
  it("mixed table orders notify both stations", () => {
    const plan = planStationTickets({ items: [kitchen, pizza], isTableOrder: true, orderedAt: at("13:59:00") });
    expect(plan.pizzaOtherStation).toBe("kueche");
    expect(plan.kitchenOtherStation).toBe("pizza");
  });
  it("does not notify about stations from previous rounds of the same table", () => {
    // Nur die aktuell gesendeten Positionen zählen: eine frühere Pizza-Runde
    // desselben Tisches darf auf dem Küchenbon keinen Hinweis auslösen.
    const plan = planStationTickets({ items: [kitchen], isTableOrder: true, orderedAt: at("13:59:00") });
    expect(plan.kitchenOtherStation).toBeUndefined();
    expect(plan.stations.pizza).toEqual([]);
  });
  it("adds one preparation-only Pizzabrot at 14:00 Zurich", () => {
    const plan = planStationTickets({ items: [kitchen], isTableOrder: true, orderedAt: at("14:00:00") });
    expect(plan.stations.pizza).toEqual([{ product_name: "Pizzabrot", category: "Pizza", qty: 1, unit_price: 0 }]);
    expect(kitchen.qty * kitchen.unit_price).toBe(36);
  });
  it("does not add bread before 14:00", () => {
    expect(planStationTickets({ items: [kitchen], isTableOrder: true, orderedAt: at("13:59:59") }).stations.pizza).toEqual([]);
  });
  it("does not add bread for takeaway or delivery", () => {
    expect(planStationTickets({ items: [kitchen], isTableOrder: false, orderedAt: at("18:00:00") }).stations.pizza).toEqual([]);
  });
  it("does not add bread for pizza-only or bar orders", () => {
    expect(planStationTickets({ items: [pizza], isTableOrder: true, orderedAt: at("18:00:00") }).stations.pizza).toEqual([pizza]);
    expect(planStationTickets({ items: [{ ...kitchen, category: "Bier" }], isTableOrder: true, orderedAt: at("18:00:00") }).stations.pizza).toEqual([]);
  });
  it("sends automatic bread and kitchen ticket to their configured printers", async () => {
    const printers = ["pizza", "kueche"].map(type => ({ id: type, name: type, type, ip_address: null, port: null }));
    const errors = await printOrderToStations({ printers, tableName: "12", items: [kitchen], isTableOrder: true, orderedAt: at("18:00:00") });
    expect(errors).toEqual([]);
    expect(printReceipt).toHaveBeenCalledTimes(2);
    expect(printReceipt).toHaveBeenNthCalledWith(1, printers[0], expect.objectContaining({ lines: expect.arrayContaining([expect.objectContaining({ text: "1  Pizzabrot" })]) }));
    expect(printReceipt).toHaveBeenNthCalledWith(2, printers[1], expect.objectContaining({ lines: expect.arrayContaining([expect.objectContaining({ text: "2  Spaghetti" })]) }));
  });
});