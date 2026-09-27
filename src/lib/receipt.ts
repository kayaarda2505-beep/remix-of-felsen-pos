import type { ReceiptPayload, PrinterConfig } from "./printer-bridge";
import { printReceipt, getAgentPrinters } from "./printer-bridge";
import { supabase } from "@/integrations/supabase/client";
import { DELIVERY_ITEMS } from "./delivery-menu";

export type ReceiptItem = {
  product_name: string;
  qty: number;
  unit_price: number;
  category?: string | null;
  description?: string | null;
  modifiers?: string[];
  note?: string | null;
};

// ---------------------------------------------------------------------------
// Stations-Routing
// ---------------------------------------------------------------------------

const BAR_CATS = new Set([
  "Signatures", "Spritz", "Cocktails", "Bier", "Wein",
  "Shots", "Spirituosen", "Softdrinks", "Mocktails", "Homemades", "Café",
  "Salate",
]);

export function routeForCategory(cat?: string | null): "bar" | "kueche" {
  if (cat && BAR_CATS.has(cat)) return "bar";
  return "kueche";
}

/** Feinere Zuordnung für den Küchen-/Bar-Bildschirm inkl. eigener Pizzastation. */
export function routeForItem(cat?: string | null, name?: string | null): "bar" | "kueche" | "pizza" {
  const c = (cat ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();
  if (c.includes("mittagsmen") && n.includes("pasta")) return "kueche";
  if (c.includes("pizza") || n.includes("pizza") || n.includes("calzone")) return "pizza";
  if (routeForCategory(cat) === "bar") return "bar";
  return "kueche";
}


export function splitByStation(items: ReceiptItem[]) {
  const bar: ReceiptItem[] = [];
  const kueche: ReceiptItem[] = [];
  const pizza: ReceiptItem[] = [];
  for (const it of items) {
    if (/mittagsmen/i.test(it.category ?? "") || /mittagsmen/i.test(it.product_name)) {
      const mods = it.modifiers ?? [];
      const drink = mods.find((m) => /(cola|fanta|sprite|rivella|eistee|ice tea|mineral|wasser|bier|apfelschorle|orangensaft|saft|red bull|schweppes|getränk)/i.test(m));
      const dressing = mods.find((m) => /(french|italien|balsamico|dressing|sosse|soße)/i.test(m));
      const mainMods = mods.filter((m) => m !== drink && m !== dressing);
      const station = routeForItem(it.category, it.product_name);
      (station === "pizza" ? pizza : kueche).push({ ...it, modifiers: mainMods });
      bar.push({ ...it, product_name: drink ? `Menüsalat + ${drink}` : "Menüsalat", category: "Salate", description: null, modifiers: dressing ? [dressing] : [] });
      continue;
    }
    const station = routeForItem(it.category, it.product_name);
    (station === "bar" ? bar : station === "pizza" ? pizza : kueche).push(it);
  }
  return { bar, kueche, pizza };
}

const pizzaName = (item: ReceiptItem) => {
  if (/mittagsmen/i.test(item.category ?? "") || /mittagsmen/i.test(item.product_name)) {
    const chosen = item.modifiers?.find((m) => /pizza|calzone/i.test(m));
    return chosen?.replace(/\s*\(\+CHF[^)]*\)\s*$/i, "").trim() ?? item.product_name;
  }
  return item.product_name;
};

function isPizza(item: ReceiptItem) {
  return routeForItem(item.category, item.product_name) === "pizza";
}

function normalizePizzaName(name: string) {
  return name.toLocaleLowerCase("de-CH").replace(/^pizza\s+/, "").replace(/\s*-\s*\d+\s*cm\s*$/, "").trim();
}

/** Use the menu's ingredients, not recipe stock entries; retain the ordered changes separately. */
async function withPizzaIngredients(items: ReceiptItem[]): Promise<ReceiptItem[]> {
  if (!items.some(isPizza)) return items;
  const { data } = await supabase.from("products").select("name, description, category").eq("active", true);
  const descriptions = [...(data ?? []), ...DELIVERY_ITEMS].filter((p) => p.description);
  return items.map((item) => {
    if (!isPizza(item)) return item;
    const name = pizzaName(item);
    const match = descriptions.find((p) => p.name.toLocaleLowerCase("de-CH") === name.toLocaleLowerCase("de-CH"))
      ?? descriptions.find((p) => normalizePizzaName(p.name) === normalizePizzaName(name));
    return { ...item, description: match?.description ?? item.description };
  });
}

function pizzaDetailLines(item: ReceiptItem): string[] {
  if (!isPizza(item)) return [];
  const removed = (item.modifiers ?? [])
    .filter((m) => /^ohne\s+/i.test(m))
    .map((m) => m.replace(/^ohne\s+/i, "").trim().toLocaleLowerCase("de-CH"));
  const ingredients = (item.description ?? "").split(/,|·|\s+und\s+/i).map((s) => s.trim()).filter(Boolean)
    .filter((s) => !removed.includes(s.toLocaleLowerCase("de-CH")));
  return ingredients.length ? [`Zutaten: ${ingredients.join(", ")}`] : [];
}

// ---------------------------------------------------------------------------
// Formatierung – 42 Spalten passen 1:1 auf 80mm Bons (TM-T20III, Font A)
// ---------------------------------------------------------------------------

const COLS = 42;

function fmt(n: number) {
  return n.toFixed(2);
}

function nowStr() {
  return new Date().toLocaleString("de-CH", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function shortId() {
  // 6-stelliger Bon-Identifier, reicht für tägliches Auseinanderhalten
  return Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
}

// ---------------------------------------------------------------------------
// Einstellungen aus app_settings (gecached pro Session)
// ---------------------------------------------------------------------------

export type ReceiptSettings = {
  businessName: string;
  currency: string;
  vatRate: number;          // Schweiz Standard: 8.1
  vatIncluded: boolean;     // Preise inkl. MWST? (Gastronomie: ja)
};

const DEFAULT_SETTINGS: ReceiptSettings = {
  businessName: "Piratino",
  currency: "CHF",
  vatRate: 8.1,
  vatIncluded: true,
};

let cached: ReceiptSettings | null = null;
let cacheAt = 0;

export async function loadReceiptSettings(): Promise<ReceiptSettings> {
  if (cached && Date.now() - cacheAt < 60_000) return cached;
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("business_name, currency, region")
      .eq("id", 1)
      .maybeSingle();
    const region = (data?.region ?? "CH").toUpperCase();
    const vatRate =
      region === "CH" ? 8.1 :
      region === "DE" ? 19 :
      region === "AT" ? 20 :
      region === "FR" ? 20 :
      region === "IT" ? 22 :
      0;
    cached = {
      businessName: data?.business_name ?? DEFAULT_SETTINGS.businessName,
      currency: data?.currency ?? DEFAULT_SETTINGS.currency,
      vatRate,
      vatIncluded: true,
    };
    cacheAt = Date.now();
    return cached;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function clearReceiptSettingsCache() {
  cached = null;
}

// ---------------------------------------------------------------------------
// Stations-Bon (Bar / Küche / Pizza)
// ---------------------------------------------------------------------------

export function buildStationTicket(opts: {
  station: "bar" | "kueche" | "pizza";
  tableName: string;
  items: ReceiptItem[];
  orderType?: string;
  operatorName?: string | null;
  orderNo?: string;
}): ReceiptPayload {
  const lines: ReceiptPayload["lines"] = [];

  const title = opts.station === "bar" ? "*** Barbon ***" : opts.station === "pizza" ? "*** Pizzabon ***" : "*** Küchenbon ***";
  lines.push({ text: title, align: "center", bold: true, size: "large" });
  lines.push({ text: "" });
  lines.push({ text: `Tisch:  ${opts.tableName}`, bold: true, size: "large" });
  if (opts.orderType) lines.push({ text: opts.orderType, bold: true, size: "double-h" });
  lines.push({ text: "" });
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  lines.push({ text: `Datum/Zeit: ${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} / ${p(d.getHours())}:${p(d.getMinutes())}`, size: "double-h" });
  if (opts.operatorName) lines.push({ text: `Benutzer:   ${opts.operatorName}`, size: "double-h" });
  lines.push({ text: "" });
  lines.push({ separator: true });
  lines.push({ text: "" });

  opts.items.forEach((it) => {
    lines.push({ text: `${it.qty}  ${it.product_name}`, bold: true, size: "large" });
    const details = pizzaDetailLines(it);
    if (details.length || it.modifiers?.length || it.note) lines.push({ text: "" });
    for (const detail of details) lines.push({ text: `   ${detail}`, size: "double-h" });
    if (it.modifiers?.length) {
      for (const m of it.modifiers) lines.push({ text: `   ${/^[+\-]/.test(m) ? "" : /^ohne\s/i.test(m) ? "- " : "+ "}${m}`, bold: true, size: "double-h" });
    }
    if (it.note) lines.push({ text: `   ! ${it.note}`, bold: true, size: "double-h" });
    lines.push({ text: "" });
    lines.push({ text: (it.unit_price * it.qty).toFixed(2), align: "right", bold: true, size: "double-h" });
    if (it !== opts.items[opts.items.length - 1]) lines.push({ text: "" });
  });

  return {
    lines,
    cut: true,
  };
}

// ---------------------------------------------------------------------------
// Rechnung / Zwischenrechnung
// ---------------------------------------------------------------------------

export function buildBill(opts: {
  tableName: string;
  items: ReceiptItem[];
  total: number;             // Bruttobetrag inkl. Trinkgeld
  subtotal?: number;         // Wenn nicht gesetzt, aus items berechnet
  tip?: number;
  interim?: boolean;
  paymentMethod?: string | null;
  settings?: ReceiptSettings;
  orderNo?: string;
  title?: string;            // z.B. "LIEFERSCHEIN"
  qrUrl?: string;            // eigener QR-Code (statt Google-Bewertung)
  qrLabel?: string;
  footerNote?: string;
}): ReceiptPayload {
  const s = opts.settings ?? DEFAULT_SETTINGS;
  const cur = s.currency;
  const lines: ReceiptPayload["lines"] = [];

  // Kopf
  lines.push({ logo: true });
  lines.push({ text: s.businessName, align: "center", bold: true, size: "double-h" });
  lines.push({ text: "Fegergasse 4", align: "center" });
  lines.push({ text: "4300 Zofingen", align: "center" });

  lines.push({ text: "", align: "center" });
  lines.push({
    text: opts.title ?? (opts.interim ? "ZWISCHENRECHNUNG" : "RECHNUNG"),
    align: "center",
    bold: true,
  });
  lines.push({ text: "", align: "center" });
  lines.push({ cols: ["Tisch", opts.tableName] });
  lines.push({ cols: ["Datum", nowStr()] });
  lines.push({ cols: ["Bon-Nr.", opts.orderNo ?? shortId()] });
  lines.push({ separator: true });


  // Spaltenkopf
  lines.push({ cols: ["Artikel", "Betrag"], bold: true });
  lines.push({ separator: true });

  // Positionen
  const subtotal =
    opts.subtotal ?? opts.items.reduce((sum, it) => sum + it.unit_price * it.qty, 0);

  for (const it of opts.items) {
    const lineTotal = it.unit_price * it.qty;
    const name = `${it.qty}x ${it.product_name}`;
    // Wenn Name + Betrag in eine Zeile passen → cols, sonst zweizeilig
    const right = `${cur} ${fmt(lineTotal)}`;
    if (name.length + right.length + 1 <= COLS) {
      lines.push({ cols: [name, right] });
    } else {
      lines.push({ text: name });
      lines.push({ cols: ["", right] });
    }
    if (it.qty > 1) {
      lines.push({ text: `   à ${cur} ${fmt(it.unit_price)}` });
    }
    if (it.modifiers?.length) {
      lines.push({ text: `   + ${it.modifiers.join(", ")}` });
    }
    for (const detail of pizzaDetailLines(it)) lines.push({ text: `   ${detail}` });
  }

  lines.push({ separator: true });

  // Summen
  const tip = opts.tip ?? Math.max(0, opts.total - subtotal);
  lines.push({ cols: ["Zwischensumme", `${cur} ${fmt(subtotal)}`] });
  lines.push({ separator: true });
  lines.push({
    cols: ["TOTAL", `${cur} ${fmt(opts.total)}`],
    bold: true,
    size: "double-h",
  });
  if (tip > 0) {
    lines.push({ cols: ["davon Trinkgeld", `${cur} ${fmt(tip)}`], bold: true });
  }

  // MWST-Aufschlüsselung (inkl.)
  if (s.vatRate > 0 && s.vatIncluded) {
    const net = opts.total / (1 + s.vatRate / 100);
    const vat = opts.total - net;
    lines.push({ text: "" });
    lines.push({ cols: [`MWST inkl. ${s.vatRate.toFixed(1)}%`, `${cur} ${fmt(vat)}`] });
    lines.push({ cols: ["Netto", `${cur} ${fmt(net)}`] });
  }

  // Zahlung
  if (opts.paymentMethod && !opts.interim) {
    lines.push({ separator: true });
    lines.push({ cols: ["Zahlart", opts.paymentMethod] });
  }

  // Fuss
  lines.push({ separator: true });
  lines.push({
    text:
      opts.footerNote ??
      (opts.interim ? "Noch nicht bezahlt" : "Vielen Dank für Ihren Besuch!"),
    align: "center",
    bold: !opts.interim,
  });

  // QR-Code: eigener (z.B. Kurier-Link) oder Google-Bewertung auf finaler Rechnung
  if (opts.qrUrl) {
    lines.push({ text: "" });
    if (opts.qrLabel) lines.push({ text: opts.qrLabel, align: "center", bold: true });
    lines.push({ text: "" });
    lines.push({ qr: opts.qrUrl, size: 7 });
    lines.push({ text: "" });
  } else if (!opts.interim) {
    lines.push({ text: "" });
    lines.push({ text: "Bitte bewerten Sie uns auf Google", align: "center", bold: true });
    lines.push({ text: "" });
    lines.push({ qr: "https://share.google/r7ny129TOY9jlwj6E", size: 6 });
    lines.push({ text: "" });
  }

  lines.push({ text: "", align: "center" });
  lines.push({ text: s.businessName, align: "center" });

  return { lines, cut: true };
}

// ---------------------------------------------------------------------------
// High-Level Drucker
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Karten-Beleg (SumUp Terminal)
// ---------------------------------------------------------------------------

export type CardReceiptInfo = {
  transactionId?: string;
  transactionCode?: string;
  cardType?: string;
  cardLast4?: string;
  authCode?: string;
  entryMode?: string;
  amount: number;
  baseAmount?: number;
  tip?: number;
  currency?: string;
  timestamp?: string;
  merchantCode?: string;
  tableName?: string;
};

export function buildCardReceipt(info: CardReceiptInfo, s: ReceiptSettings): ReceiptPayload {
  const cur = info.currency ?? s.currency;
  const lines: ReceiptPayload["lines"] = [];

  lines.push({ text: s.businessName, align: "center", bold: true, size: "double-h" });
  lines.push({ text: "Fegergasse 4 · 4300 Zofingen", align: "center" });
  lines.push({ text: "" });
  lines.push({ text: "KARTEN-BELEG", align: "center", bold: true });
  lines.push({ text: "Händlerbeleg", align: "center" });
  lines.push({ separator: true });

  lines.push({ cols: ["Datum", info.timestamp ? new Date(info.timestamp).toLocaleString("de-CH") : nowStr()] });
  if (info.tableName) lines.push({ cols: ["Tisch", info.tableName] });
  if (info.merchantCode) lines.push({ cols: ["Händler", info.merchantCode] });
  if (info.transactionCode) lines.push({ cols: ["Beleg-Nr.", info.transactionCode] });
  if (info.transactionId) lines.push({ cols: ["Trans-ID", info.transactionId.slice(-12)] });
  if (info.cardType) lines.push({ cols: ["Karte", info.cardType] });
  if (info.cardLast4) lines.push({ cols: ["PAN", `**** ${info.cardLast4}`] });
  if (info.entryMode) lines.push({ cols: ["Eingabe", info.entryMode] });
  if (info.authCode) lines.push({ cols: ["Auth-Code", info.authCode] });

  lines.push({ separator: true });
  const tip = Number(info.tip ?? 0);
  if (tip > 0 && info.baseAmount) {
    lines.push({ cols: ["Rechnung", `${cur} ${fmt(info.baseAmount)}`] });
    lines.push({ cols: ["Trinkgeld", `${cur} ${fmt(tip)}`], bold: true });
    lines.push({ separator: true });
  }
  lines.push({
    cols: ["BETRAG", `${cur} ${fmt(info.amount)}`],
    bold: true,
    size: "double-h",
  });
  lines.push({ separator: true });
  lines.push({ text: "Zahlung genehmigt", align: "center", bold: true });
  lines.push({ text: "Vielen Dank!", align: "center" });
  lines.push({ text: "" });
  lines.push({ text: "Abgewickelt über SumUp", align: "center" });

  return { lines, cut: true };
}

export async function printCardReceipt(opts: {
  printers: PrinterConfig[];
  info: CardReceiptInfo;
}): Promise<string | null> {
  let billPrinter: PrinterConfig | undefined =
    opts.printers.find((p) => p.type === "rechnung") ??
    opts.printers.find((p) => p.type === "bon");
  if (!billPrinter && opts.printers.length) return "Kein Rechnungsdrucker konfiguriert";

  if (!billPrinter) {
    const r = await getAgentPrinters();
    const def = r.printers?.find((p) => p.isDefault) ?? r.printers?.[0];
    if (!def) return null; // kein Drucker → still überspringen, kein Fehler
    billPrinter = { id: "agent-default", name: def.name, type: "bon", ip_address: null, port: null };
  }

  const settings = await loadReceiptSettings();
  const r = await printReceipt(billPrinter, buildCardReceipt(opts.info, settings));
  return r.ok ? null : r.error ?? "Druckfehler";
}

export async function printOrderToStations(opts: {
  printers: PrinterConfig[];
  tableName: string;
  items: ReceiptItem[];
  operatorName?: string | null;
  orderType?: string;
}): Promise<string[]> {
  const errors: string[] = [];
  const { bar, kueche, pizza } = splitByStation(await withPizzaIngredients(opts.items));

  const barPrinter = opts.printers.find((p) => p.type === "bar");
  const kuechePrinter = opts.printers.find((p) => p.type === "kueche");
  const pizzaPrinter = opts.printers.find((p) => p.type === "pizza");
  const orderNo = shortId();

  for (const [station, items, printer] of [
    ["pizza", pizza, pizzaPrinter],
    ["kueche", kueche, kuechePrinter],
    ["bar", bar, barPrinter ?? kuechePrinter],
  ] as const) {
    if (!items.length) continue;
    const label = station === "pizza" ? "Pizza" : station === "kueche" ? "Küche" : "Bar";
    if (!printer) {
      errors.push(`${label}: Kein ${station === "bar" ? "Bar- oder Küchen-" : `${label}-`}Drucker konfiguriert`);
      continue;
    }
    const r = await printReceipt(printer, buildStationTicket({
      station, tableName: opts.tableName, items,
      orderType: opts.orderType, operatorName: opts.operatorName, orderNo,
    }));
    if (!r.ok) errors.push(`${label}: ${r.error ?? "Druck fehlgeschlagen"}`);
  }

  return errors;
}

export async function printBill(opts: {
  printers: PrinterConfig[];
  tableName: string;
  items: ReceiptItem[];
  total: number;
  subtotal?: number;
  tip?: number;
  interim?: boolean;
  paymentMethod?: string | null;
  title?: string;
  qrUrl?: string;
  qrLabel?: string;
  footerNote?: string;
}): Promise<string | null> {
  let billPrinter: PrinterConfig | undefined =
    opts.printers.find((p) => p.type === "rechnung") ??
    opts.printers.find((p) => p.type === "bon");
  if (!billPrinter && opts.printers.length) return "Kein Rechnungsdrucker konfiguriert";

  // Fallback: kein Drucker in der DB konfiguriert → Standard-Windows-Drucker
  // vom Print-Agent verwenden, damit der Bon trotzdem rauskommt.
  if (!billPrinter) {
    const r = await getAgentPrinters();
    const def = r.printers?.find((p) => p.isDefault) ?? r.printers?.[0];
    if (!def) {
      return null; // kein Drucker → stillschweigend überspringen
    }
    billPrinter = { id: "agent-default", name: def.name, type: "bon", ip_address: null, port: null };
  }

  const settings = await loadReceiptSettings();
  const items = await withPizzaIngredients(opts.items);
  const r = await printReceipt(billPrinter, buildBill({ ...opts, items, settings }));
  return r.ok ? null : r.error ?? "Druckfehler";
}

// ---------------------------------------------------------------------------
// Tagesumsatz / Z-Report
// ---------------------------------------------------------------------------

export type DailyReportData = {
  rangeLabel: string;            // "Heute · Mittwoch, 17.06.2026" o.ä.
  revenue: number;
  tipTotal?: number;
  expenseTotal: number;
  feeTotal: number;
  profit: number;
  avgTicket: number;
  closedOrdersCount: number;
  byCategory: [string, number][];
  feesByMethod?: { label: string; sum: number; count: number; volume: number }[];
  expensesByCategory?: [string, number][];
};

export function buildDailyReport(d: DailyReportData, s: ReceiptSettings): ReceiptPayload {
  const cur = s.currency;
  const lines: ReceiptPayload["lines"] = [];

  lines.push({ logo: true });
  lines.push({ text: s.businessName, align: "center", bold: true, size: "double-h" });
  lines.push({ text: "Fegergasse 4", align: "center" });
  lines.push({ text: "4300 Zofingen", align: "center" });
  lines.push({ text: "" });
  lines.push({ text: "TAGESABSCHLUSS", align: "center", bold: true });
  lines.push({ text: d.rangeLabel, align: "center" });
  lines.push({ text: `Gedruckt: ${nowStr()}`, align: "center" });
  lines.push({ separator: true });

  // Kern-Kennzahlen
  lines.push({ cols: ["Umsatz brutto", `${cur} ${fmt(d.revenue)}`], bold: true });
  if (Number(d.tipTotal ?? 0) > 0) {
    lines.push({ cols: ["Trinkgeld", `${cur} ${fmt(Number(d.tipTotal ?? 0))}`], bold: true });
  }
  lines.push({ cols: ["Abschlüsse", String(d.closedOrdersCount)] });
  lines.push({ cols: ["Ø Bon", `${cur} ${fmt(d.avgTicket)}`] });
  lines.push({ separator: true });

  // Umsatz nach Kategorie
  if (d.byCategory.length > 0) {
    lines.push({ text: "Umsatz nach Kategorie", bold: true });
    for (const [cat, sum] of d.byCategory) {
      lines.push({ cols: [cat, `${cur} ${fmt(sum)}`] });
    }
    lines.push({ separator: true });
  }

  // Zahlungsgebühren
  if (d.feesByMethod && d.feesByMethod.length > 0) {
    lines.push({ text: "Zahlungsgebühren", bold: true });
    for (const f of d.feesByMethod) {
      lines.push({ cols: [`${f.label} (${f.count}x)`, `- ${cur} ${fmt(f.sum)}`] });
    }
    lines.push({ cols: ["Total Gebühren", `- ${cur} ${fmt(d.feeTotal)}`], bold: true });
    lines.push({ separator: true });
  }

  // Ausgaben
  if (d.expensesByCategory && d.expensesByCategory.length > 0) {
    lines.push({ text: "Ausgaben", bold: true });
    for (const [cat, sum] of d.expensesByCategory) {
      lines.push({ cols: [cat, `- ${cur} ${fmt(sum)}`] });
    }
    lines.push({ cols: ["Total Ausgaben", `- ${cur} ${fmt(d.expenseTotal)}`], bold: true });
    lines.push({ separator: true });
  }

  // Gewinn
  lines.push({
    cols: ["GEWINN", `${cur} ${fmt(d.profit)}`],
    bold: true,
    size: "double-h",
  });

  // MWST inkl. (auf Umsatz)
  if (s.vatRate > 0 && s.vatIncluded && d.revenue > 0) {
    const net = d.revenue / (1 + s.vatRate / 100);
    const vat = d.revenue - net;
    lines.push({ text: "" });
    lines.push({ cols: [`MWST inkl. ${s.vatRate.toFixed(1)}%`, `${cur} ${fmt(vat)}`] });
    lines.push({ cols: ["Umsatz netto", `${cur} ${fmt(net)}`] });
  }

  lines.push({ separator: true });
  lines.push({ text: "— Ende Tagesabschluss —", align: "center" });
  lines.push({ text: "" });
  lines.push({ text: s.businessName, align: "center" });

  return { lines, cut: true };
}

export async function printDailyReport(opts: {
  printers: PrinterConfig[];
  data: DailyReportData;
}): Promise<string | null> {
  let billPrinter: PrinterConfig | undefined =
    opts.printers.find((p) => p.type === "rechnung") ??
    opts.printers.find((p) => p.type === "bon") ??
    opts.printers[0];

  if (!billPrinter) {
    const r = await getAgentPrinters();
    const def = r.printers?.find((p) => p.isDefault) ?? r.printers?.[0];
    if (!def) return "Kein Drucker konfiguriert – bitte unter Einstellungen › Drucker einen Drucker hinzufügen";
    billPrinter = { id: "agent-default", name: def.name, type: "bon", ip_address: null, port: null };
  }

  const settings = await loadReceiptSettings();
  const r = await printReceipt(billPrinter, buildDailyReport(opts.data, settings));
  return r.ok ? null : r.error ?? "Druckfehler";
}

