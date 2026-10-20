/** Vergleichsschlüssel für Telefonnummern: letzte 9 Ziffern (CH: +41 79…, 0041 79…, 079… → gleich). */
export function phoneKey(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = phoneKey(a);
  return ka.length >= 9 && ka === phoneKey(b);
}
