// Schweizer MwSt-Sätze. Ein Beleg kann mehrere Sätze enthalten (z. B. Lebensmittel 2.6 %
// und Non-Food 8.1 %); jeder Satz wird separat geführt, vat_amount ist nur die Summe.

export const SWISS_VAT_RATES = [8.1, 2.6, 3.8] as const; // ab 2024: Normal, reduziert, Beherbergung
const LEGACY_SWISS_VAT_RATES = [7.7, 2.5, 3.7] as const; // bis Ende 2023 (alte Belege)
const ALLOWED = [...SWISS_VAT_RATES, ...LEGACY_SWISS_VAT_RATES];

export type VatLine = { rate: number; gross: number | null; vat: number };

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(",", ".").replace("%", "").trim()) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/** Gibt den passenden offiziellen Schweizer Satz zurück, sonst null (z. B. 10.02 → null). */
export function snapSwissRate(rate: unknown): number | null {
  const r = num(rate);
  if (r == null) return null;
  let best: number | null = null;
  let diff = Infinity;
  for (const a of ALLOWED) {
    const d = Math.abs(a - r);
    if (d < diff) { diff = d; best = a; }
  }
  return diff <= 0.15 ? best : null;
}

/** MwSt-Anteil aus einem Betrag inkl. MwSt. */
export function vatFromGross(gross: number, rate: number): number {
  return round2((gross * rate) / (100 + rate));
}

/** Bereinigt rohe MwSt-Zeilen: nur Schweizer Sätze, gleiche Sätze zusammengefasst. */
export function normalizeVatLines(raw: unknown): VatLine[] {
  if (!Array.isArray(raw)) return [];
  const byRate = new Map<number, VatLine>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const gross = num(o["gross"] ?? o["gross_amount"]);
    let vat = num(o["vat"] ?? o["vat_amount"]);
    let rate = snapSwissRate(o["rate"]);
    if (rate == null && gross != null && vat != null && gross > vat) {
      rate = snapSwissRate((vat / (gross - vat)) * 100);
    }
    if (rate == null) continue;
    if (vat == null && gross != null) vat = vatFromGross(gross, rate);
    if (vat == null || vat <= 0) continue;
    const prev = byRate.get(rate);
    byRate.set(rate, {
      rate,
      gross: prev ? (prev.gross != null && gross != null ? round2(prev.gross + gross) : prev.gross ?? gross) : gross != null ? round2(gross) : null,
      vat: round2((prev?.vat ?? 0) + vat),
    });
  }
  return [...byRate.values()].sort((a, b) => b.rate - a.rate);
}

export function vatTotal(lines: VatLine[]): number {
  return round2(lines.reduce((s, l) => s + l.vat, 0));
}

export function formatRate(rate: number): string {
  return rate.toFixed(1);
}
