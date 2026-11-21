// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mock = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>>, payloads: [] as Array<Record<string, unknown>>, fail: false }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  if (table !== "manual_revenues") throw new Error("Unexpected table");
  const chain = {
    select: () => chain, gte: () => chain, lte: () => chain, order: () => chain,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [...mock.rows], error: null }).then(resolve),
    insert: async (payload: Record<string, unknown>) => {
      if (mock.fail) return { error: new Error("Speichern fehlgeschlagen") };
      mock.payloads.push(payload);
      mock.rows.push({ id: "test-revenue", ...payload });
      return { error: null };
    },
  };
  return chain;
} } }));

import { ManualRevenueSection } from "@/components/ManualRevenueSection";
function renderSection(canManage = true) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ManualRevenueSection from="2026-11-01" to="2026-11-30" canManage={canManage} /></QueryClientProvider>);
}
beforeEach(() => { mock.rows = []; mock.payloads = []; mock.fail = false; });
afterEach(cleanup);

test("Betrag und Website-Herkunft speichern und erneut in der Liste anzeigen", async () => {
  renderSection();
  fireEvent.click(screen.getByRole("button", { name: "Umsatz erfassen" }));
  fireEvent.change(screen.getByLabelText("Datum"), { target: { value: "2026-11-21" } });
  fireEvent.change(screen.getByLabelText("Betrag (CHF)"), { target: { value: "245,50" } });
  fireEvent.change(screen.getByLabelText("Umsatzherkunft"), { target: { value: "website" } });
  fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
  await waitFor(() => expect(mock.payloads).toEqual([{ revenue_date: "2026-11-21", amount: 245.5, source: "website", note: null }]));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByText("Website", { selector: "div" })).toBeTruthy();
  expect(screen.getAllByText("245.50 CHF")).toHaveLength(2);
  fireEvent.change(screen.getByLabelText("Umsatzherkunft filtern"), { target: { value: "uber_eats" } });
  expect(screen.queryByText("245.50 CHF")).toBeNull();
});

test("Speicherfehler bleibt sichtbar und Eingaben bleiben erhalten", async () => {
  mock.fail = true;
  renderSection();
  fireEvent.click(screen.getByRole("button", { name: "Umsatz erfassen" }));
  fireEvent.change(screen.getByLabelText("Betrag (CHF)"), { target: { value: "30" } });
  fireEvent.change(screen.getByLabelText("Umsatzherkunft"), { target: { value: "takeaway" } });
  fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Speichern fehlgeschlagen");
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(mock.payloads).toHaveLength(0);
});

test("ohne Berechtigung kann kein Umsatz erfasst werden", () => {
  renderSection(false);
  expect(screen.getByRole("button", { name: "Umsatz erfassen" }).hasAttribute("disabled")).toBe(true);
});