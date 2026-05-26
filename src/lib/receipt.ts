import type { ReceiptPayload, PrinterConfig } from "./printer-bridge";
import { printReceipt } from "./printer-bridge";

export type ReceiptItem = {
  product_name: string;
  qty: number;
  unit_price: number;
  category?: string | null;
  modifiers?: string[];
  note?: string | null;
};

const BAR_CATS = new Set([
  "Signatures", "Spritz", "Cocktails", "Bier", "Wein",
  "Shots", "Spirituosen", "Softdrinks", "Mocktails", "Homemades",
]);

export function routeForCategory(cat?: string | null): "bar" | "kueche" {
  if (cat && BAR_CATS.has(cat)) return "bar";
  return "kueche";
}

export function splitByStation(items: ReceiptItem[]) {
  const bar: ReceiptItem[] = [];
  const kueche: ReceiptItem[] = [];
  for (const it of items) (routeForCategory(it.category) === "bar" ? bar : kueche).push(it);
  return { bar, kueche };
}

function fmt(n: number) {
  return n.toFixed(2);
}

export function buildStationTicket(opts: {
  station: "bar" | "kueche";
  tableName: string;
  items: ReceiptItem[];
  operatorName?: string | null;
}): ReceiptPayload {
  const lines: ReceiptPayload["lines"] = [];
  lines.push({ text: `Tisch ${opts.tableName}`, align: "center", bold: true, size: "large" });
  lines.push({ text: new Date().toLocaleString("de-CH"), align: "center" });
  if (opts.operatorName) lines.push({ text: opts.operatorName, align: "center" });
  lines.push({ separator: true });
  for (const it of opts.items) {
    lines.push({ text: `${it.qty}x  ${it.product_name}`, bold: true, size: "double-h" });
    if (it.modifiers?.length) lines.push({ text: `   + ${it.modifiers.join(", ")}` });
    if (it.note) lines.push({ text: `   ! ${it.note}` });
  }
  lines.push({ separator: true });
  return {
    title: opts.station === "bar" ? "BAR" : "KÜCHE",
    lines,
    cut: true,
  };
}

export function buildBill(opts: {
  tableName: string;
  items: ReceiptItem[];
  total: number;
  interim?: boolean;
  paymentMethod?: string | null;
  businessName?: string;
}): ReceiptPayload {
  const lines: ReceiptPayload["lines"] = [];
  lines.push({ text: opts.businessName ?? "SAINTS", align: "center", bold: true });
  lines.push({ text: opts.interim ? "Zwischenrechnung" : "Rechnung", align: "center" });
  lines.push({ text: `Tisch ${opts.tableName}`, align: "center" });
  lines.push({ text: new Date().toLocaleString("de-CH"), align: "center" });
  lines.push({ separator: true });
  for (const it of opts.items) {
    lines.push({
      cols: [
        `${it.qty}x ${it.product_name}`.slice(0, 28),
        `CHF ${fmt(it.unit_price * it.qty)}`,
      ],
    });
    if (it.modifiers?.length) lines.push({ text: `   + ${it.modifiers.join(", ")}` });
  }
  lines.push({ separator: true });
  lines.push({ cols: ["TOTAL", `CHF ${fmt(opts.total)}`], bold: true, size: "double-h" });
  if (opts.paymentMethod) {
    lines.push({ separator: true });
    lines.push({ cols: ["Zahlart", opts.paymentMethod] });
  }
  lines.push({ separator: true });
  lines.push({ text: "Vielen Dank!", align: "center" });
  return { lines, cut: true };
}

// High-level: druckt Bestellung an Bar- und Küchen-Drucker
export async function printOrderToStations(opts: {
  printers: PrinterConfig[];
  tableName: string;
  items: ReceiptItem[];
  operatorName?: string | null;
}): Promise<string[]> {
  const errors: string[] = [];
  const { bar, kueche } = splitByStation(opts.items);

  const barPrinter = opts.printers.find((p) => p.type === "bar");
  const kuechePrinter = opts.printers.find((p) => p.type === "kueche");

  if (bar.length && barPrinter) {
    const r = await printReceipt(barPrinter, buildStationTicket({
      station: "bar", tableName: opts.tableName, items: bar, operatorName: opts.operatorName,
    }));
    if (!r.ok && r.error) errors.push(`Bar: ${r.error}`);
  }
  if (kueche.length && kuechePrinter) {
    const r = await printReceipt(kuechePrinter, buildStationTicket({
      station: "kueche", tableName: opts.tableName, items: kueche, operatorName: opts.operatorName,
    }));
    if (!r.ok && r.error) errors.push(`Küche: ${r.error}`);
  }
  return errors;
}

export async function printBill(opts: {
  printers: PrinterConfig[];
  tableName: string;
  items: ReceiptItem[];
  total: number;
  interim?: boolean;
  paymentMethod?: string | null;
}): Promise<string | null> {
  const billPrinter =
    opts.printers.find((p) => p.type === "rechnung") ??
    opts.printers.find((p) => p.type === "bon") ??
    opts.printers[0];
  if (!billPrinter) return "Kein Rechnungsdrucker konfiguriert";
  const r = await printReceipt(billPrinter, buildBill(opts));
  return r.ok ? null : r.error ?? "Druckfehler";
}
