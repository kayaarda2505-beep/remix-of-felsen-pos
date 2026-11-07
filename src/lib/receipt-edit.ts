// Reine Logik für „Beleg bearbeiten": berechnet aus Original-Positionen und
// bearbeiteten Zeilen die nötigen Änderungen und die Anpassung der Zahlung.

export interface EditLine {
  /** vorhandene order_items.id; fehlt bei neu hinzugefügten Positionen */
  id?: string;
  product_id: string;
  product_name: string;
  category: string | null;
  unit_price: number;
  qty: number;
  modifiers: string[];
  note: string | null;
}

export interface ReceiptEditPlan {
  deleteIds: string[];
  updates: Array<{ id: string; qty: number; note: string | null }>;
  inserts: EditLine[];
  oldSubtotal: number;
  newSubtotal: number;
  delta: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function subtotal(lines: Array<{ unit_price: number; qty: number }>) {
  return round2(lines.reduce((s, l) => s + Number(l.unit_price) * Number(l.qty), 0));
}

export function planReceiptEdit(original: EditLine[], edited: EditLine[]): ReceiptEditPlan {
  const editedById = new Map(edited.filter((l) => l.id).map((l) => [l.id!, l]));
  const deleteIds: string[] = [];
  const updates: ReceiptEditPlan["updates"] = [];
  for (const o of original) {
    if (!o.id) continue;
    const e = editedById.get(o.id);
    if (!e || e.qty <= 0) {
      deleteIds.push(o.id);
      continue;
    }
    const note = e.note?.trim() ? e.note.trim() : null;
    if (e.qty !== o.qty || note !== (o.note ?? null)) updates.push({ id: o.id, qty: e.qty, note });
  }
  const inserts = edited
    .filter((l) => !l.id && l.qty > 0)
    .map((l) => ({ ...l, note: l.note?.trim() ? l.note.trim() : null }));
  const oldSubtotal = subtotal(original);
  const newSubtotal = subtotal(edited.filter((l) => l.qty > 0));
  return { deleteIds, updates, inserts, oldSubtotal, newSubtotal, delta: round2(newSubtotal - oldSubtotal) };
}

/**
 * Verteilt die Differenz auf die letzte Zahlung (Trinkgeld bleibt unverändert).
 * Ein Betrag fällt nie unter 0; ein verbleibender Rest wird auf frühere Zahlungen verteilt.
 */
export function adjustPayments<T extends { id: string; amount: number }>(payments: T[], delta: number) {
  const out: Array<{ id: string; amount: number }> = [];
  let rest = round2(delta);
  for (let i = payments.length - 1; i >= 0 && rest !== 0; i--) {
    const p = payments[i];
    const next = round2(Math.max(0, Number(p.amount) + rest));
    rest = round2(rest - (next - Number(p.amount)));
    if (next !== Number(p.amount)) out.push({ id: p.id, amount: next });
  }
  return out;
}
