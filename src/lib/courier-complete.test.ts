import { describe, expect, test, vi } from "vitest";
import { CompleteSchema, runCompleteCourierDelivery } from "./courier-complete.server";

const ID = "8a2a20b0-7be6-486f-8de6-118e2b152230";

function mockDb(opts: { order?: any; existing?: any[]; existingErr?: any; insertErr?: any; updateErr?: any }) {
  const calls: { table: string; op: string; payload?: any }[] = [];
  const db = {
    from(table: string) {
      const q: any = {
        _op: "select",
        select() { return q; },
        eq() { return q; },
        is() { return q; },
        maybeSingle: async () => ({ data: opts.order ?? null, error: null }),
        insert: async (payload: any) => { calls.push({ table, op: "insert", payload }); return { error: opts.insertErr ?? null }; },
        update(payload: any) { calls.push({ table, op: "update", payload }); q._op = "update"; return q; },
        then(res: any, rej: any) {
          const out = q._op === "update"
            ? { error: opts.updateErr ?? null }
            : { data: opts.existing ?? [], error: opts.existingErr ?? null };
          return Promise.resolve(out).then(res, rej);
        },
      };
      return q;
    },
  };
  return { db, calls };
}

describe("Kurier-Abschluss Handler", () => {
  for (const method of ["cash", "card", "twint"] as const) {
    test(`${method}: bucht offenen Betrag mit Methode ${method} und schliesst ab`, async () => {
      const { db, calls } = mockDb({ order: { id: ID, status: "open", total: 26.5 } });
      const review = vi.fn(async () => {});
      const res = await runCompleteCourierDelivery(db, CompleteSchema.parse({ id: ID, method }), review);
      const ins = calls.find((c) => c.op === "insert")!;
      expect(ins.payload).toMatchObject({ method, amount: 26.5, tip: 0, status: "paid" });
      expect(calls.find((c) => c.table === "orders" && c.op === "update")!.payload.status).toBe("paid");
      expect(res).toMatchObject({ ok: true, method, amount: 26.5 });
      expect(review).toHaveBeenCalledWith(ID);
    });
  }

  test("Restbetrag wird auf Rappen gerundet", async () => {
    const { db, calls } = mockDb({ order: { id: ID, status: "open", total: "63.95" }, existing: [{ amount: 30 }] });
    await runCompleteCourierDelivery(db, { id: ID, method: "cash" }, async () => {});
    expect(calls.find((c) => c.op === "insert")!.payload.amount).toBe(33.95);
  });

  test("Fehler beim Lesen bisheriger Zahlungen bricht ab (keine Doppelbuchung)", async () => {
    const { db, calls } = mockDb({ order: { id: ID, status: "open", total: 20 }, existingErr: { message: "db down" } });
    await expect(runCompleteCourierDelivery(db, { id: ID, method: "cash" }, async () => {})).rejects.toThrow("db down");
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });

  test("Speicherfehler beim Zahlungseintrag wird gemeldet, Bestellung bleibt offen", async () => {
    const { db, calls } = mockDb({ order: { id: ID, status: "open", total: 20 }, insertErr: { message: "check constraint" } });
    await expect(runCompleteCourierDelivery(db, { id: ID, method: "twint" }, async () => {})).rejects.toThrow("check constraint");
    expect(calls.some((c) => c.op === "update")).toBe(false);
  });

  test("unbekannte Bestellung und stornierte Bestellung werden abgelehnt", async () => {
    await expect(runCompleteCourierDelivery(mockDb({}).db, { id: ID, method: "cash" }, async () => {})).rejects.toThrow("nicht gefunden");
    await expect(runCompleteCourierDelivery(mockDb({ order: { id: ID, status: "cancelled", total: 5 } }).db, { id: ID, method: "cash" }, async () => {})).rejects.toThrow("storniert");
  });

  test("Validierung: Pflichtdaten und ungültige Methode/Trinkgeld", () => {
    expect(() => CompleteSchema.parse({ method: "cash" })).toThrow();
    expect(() => CompleteSchema.parse({ id: ID })).toThrow();
    expect(() => CompleteSchema.parse({ id: ID, method: "bitcoin" })).toThrow();
    expect(() => CompleteSchema.parse({ id: ID, method: "cash", tip: "2" })).toThrow();
    expect(CompleteSchema.parse({ id: ID, method: "cash", tip: 2 }).tip).toBe(2);
  });
});
