// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const ID = "8a2a20b0-7be6-486f-8de6-118e2b152230";
const state = vi.hoisted(() => ({ status: "open" as string, completeImpl: null as any }));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: any) => ({ options: opts, useParams: () => ({ id: "8a2a20b0-7be6-486f-8de6-118e2b152230" }) }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: any) => fn }));
vi.mock("@/hooks/use-courier-geo", () => ({ useCourierGeo: () => {} }));
vi.mock("@/lib/courier.functions", () => ({
  getCourierOrder: vi.fn(async () => ({
    order: {
      id: ID, status: state.status, total: 26.5, paid: 0, items: [], customer: null,
      delivery_address: "Musterstrasse 1", delivery_note: null, courier_name: null,
      courier_started_at: "2026-10-06T10:00:00Z", courier_delivered_at: null,
    },
  })),
  listMyCourierOrders: vi.fn(async () => ({ courier: null, orders: [] })),
  startCourierDelivery: vi.fn(),
  resendTrackingSms: vi.fn(),
  completeCourierDelivery: vi.fn((args: any) => state.completeImpl(args)),
}));

import { Route } from "@/routes/kurier.$id";
import { completeCourierDelivery } from "@/lib/courier.functions";

function renderPage() {
  const Page = (Route as any).options.component;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Page /></QueryClientProvider>);
}

beforeEach(() => { state.status = "open"; vi.mocked(completeCourierDelivery).mockClear(); });
afterEach(cleanup);

describe("Kurierseite Abschluss", () => {
  for (const [label, method] of [["Bar", "cash"], ["Karte", "card"], ["TWINT", "twint"]] as const) {
    test(`${label} sendet ${method} und zeigt danach Abschluss`, async () => {
      state.completeImpl = async () => { state.status = "paid"; return { ok: true }; };
      renderPage();
      fireEvent.click(await screen.findByText("Lieferung abschliessen"));
      fireEvent.click(screen.getByRole("button", { name: label }));
      await waitFor(() => expect(completeCourierDelivery).toHaveBeenCalledWith({ data: { id: ID, method } }));
      expect(await screen.findByText("Lieferung abgeschlossen")).toBeTruthy();
    });
  }

  test("Backendfehler wird sichtbar angezeigt", async () => {
    state.completeImpl = async () => { throw new Error("check constraint verletzt"); };
    renderPage();
    fireEvent.click(await screen.findByText("Lieferung abschliessen"));
    fireEvent.click(screen.getByRole("button", { name: "Bar" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("check constraint verletzt");
    expect(screen.queryByText("Lieferung abgeschlossen")).toBeNull();
  });
});
