import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { X, Minus, Plus, Check } from "lucide-react";
import type { ModifierGroup, Product } from "@/hooks/use-products";
import { PIZZA_TOPPINGS, isPizzaItem, toppingPrice } from "@/lib/pizza-toppings";

const DEFAULT_MODIFIER_GROUPS: ModifierGroup[] = [
  {
    label: "Eis",
    items: [{ label: "mit Eis" }, { label: "ohne Eis" }],
  },
  {
    label: "Zitrone",
    items: [{ label: "mit Zitrone" }, { label: "ohne Zitrone" }],
  },
  {
    label: "Sonstiges",
    items: [{ label: "Zum Mitnehmen" }, { label: "Allergie!" }],
  },
];


export interface SideOption {
  id: string;
  name: string;
  price: number;
}

export interface ProductCustomization {
  qty: number;
  modifiers: string[];
  note?: string;
  priceDelta: number;
}

export function ProductModifierDialog({
  product,
  open,
  sides = [],
  onClose,
  onConfirm,
}: {
  product: Product | null;
  open: boolean;
  sides?: SideOption[];
  onClose: () => void;
  onConfirm: (c: ProductCustomization) => void;
}) {
  const [qty, setQty] = useState(1);
  const [mods, setMods] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [removedSides, setRemovedSides] = useState<string[]>([]);
  const [extraSides, setExtraSides] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open) {
      setQty(1);
      setMods([]);
      setNote("");
      setRemovedSides([]);
      setRemovedIngredients([]);
      setExtraSides({});
    }
  }, [open, product?.id]);

  const toggle = (m: string) =>
    setMods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const toggleRemoved = (name: string) =>
    setRemovedSides((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));

  const bumpExtra = (id: string, d: number) =>
    setExtraSides((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + d);
      const out = { ...prev };
      if (next === 0) delete out[id];
      else out[id] = next;
      return out;
    });

  const ingredients = ((product?.description ?? "") as string)
    .split(/,|·/)
    .map((x) => x.trim())
    .filter((x) => x.length > 1 && x.length < 30);

  const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);

  const toppingOptions = product && isPizzaItem(product.name, product.category)
    ? PIZZA_TOPPINGS.map((t) => ({
        ...t,
        price: toppingPrice(t, product.name, product.category),
      }))
    : [];

  const extrasDelta =
    sides.reduce((s, o) => s + (extraSides[o.id] ?? 0) * o.price, 0) +
    toppingOptions.reduce((s, t) => s + (extraSides[t.id] ?? 0) * t.price, 0);
  const sideModifiers = [
    ...removedIngredients.map((n) => `ohne ${n}`),
    ...removedSides.map((n) => `ohne ${n}`),
    ...toppingOptions
      .filter((t) => (extraSides[t.id] ?? 0) > 0)
      .map((t) => `+ ${t.name}${(extraSides[t.id] ?? 0) > 1 ? ` x${extraSides[t.id]}` : ""}`),
    ...sides
      .filter((o) => (extraSides[o.id] ?? 0) > 0)
      .map((o) => `+ ${o.name}${(extraSides[o.id] ?? 0) > 1 ? ` x${extraSides[o.id]}` : ""}`),
  ];
  const unitPrice = (product?.price ?? 0) + extrasDelta;


  return (
    <AnimatePresence>
      {open && product && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong w-full md:max-w-lg rounded-t-3xl md:rounded-3xl border border-border/40 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-5 border-b border-border/40 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {product.category}
                </div>
                <h3 className="font-semibold text-xl leading-tight mt-0.5 truncate">
                  {product.name}
                </h3>
                <div className="text-sm text-muted-foreground tabular-nums mt-1">
                  CHF {product.price.toFixed(2)}
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl glass flex items-center justify-center active:scale-95 transition-transform"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <section className="space-y-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Extrawünsche
                </div>
                {(() => {
                  const groups: ModifierGroup[] =
                    product.modifier_groups && product.modifier_groups.length > 0
                      ? product.modifier_groups
                      : DEFAULT_MODIFIER_GROUPS;
                  return groups.map((group) => (
                    <div key={group.label}>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1.5">
                        {group.label}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((item) => {
                          const label =
                            item.price_delta && item.price_delta !== 0
                              ? `${item.label} (+CHF ${item.price_delta.toFixed(2)})`
                              : item.label;
                          const active = mods.includes(label);
                          return (
                            <button
                              key={item.label}
                              onClick={() => toggle(label)}
                              className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-all tap-highlight-none active:scale-95 ${
                                active
                                  ? "bg-accent text-accent-foreground border-accent shadow-[var(--shadow-gold)]"
                                  : "glass border-border/40 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {active && <Check className="w-3 h-3 inline mr-1 -mt-0.5" />}
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </section>

              {ingredients.length > 0 && (
                <section className="space-y-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Zutaten entfernen
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ingredients.map((ing) => {
                      const active = removedIngredients.includes(ing);
                      return (
                        <button
                          key={`ing-${ing}`}
                          onClick={() =>
                            setRemovedIngredients((prev) =>
                              prev.includes(ing) ? prev.filter((x) => x !== ing) : [...prev, ing],
                            )
                          }
                          className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-all tap-highlight-none active:scale-95 ${
                            active
                              ? "bg-destructive/20 text-destructive border-destructive/50"
                              : "glass border-border/40 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          ohne {ing}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {sides.length > 0 && (
                <section className="space-y-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Beilagen
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1.5">
                      Entfernen
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sides.map((s) => {
                        const active = removedSides.includes(s.name);
                        return (
                          <button
                            key={`rm-${s.id}`}
                            onClick={() => toggleRemoved(s.name)}
                            className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-all tap-highlight-none active:scale-95 ${
                              active
                                ? "bg-destructive/20 text-destructive border-destructive/50"
                                : "glass border-border/40 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            ohne {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1.5">
                      Zusätzlich
                    </div>
                    <div className="space-y-1.5">
                      {sides.map((s) => {
                        const n = extraSides[s.id] ?? 0;
                        return (
                          <div
                            key={`add-${s.id}`}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2 border ${
                              n > 0 ? "bg-accent/10 border-accent/40" : "glass border-border/40"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm truncate">{s.name}</div>
                              <div className="text-[11px] text-muted-foreground tabular-nums">
                                +CHF {s.price.toFixed(2)}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 glass rounded-lg p-0.5">
                              <button
                                onClick={() => bumpExtra(s.id, -1)}
                                className="w-8 h-8 rounded-md flex items-center justify-center active:bg-white/10"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center text-sm tabular-nums">{n}</span>
                              <button
                                onClick={() => bumpExtra(s.id, 1)}
                                className="w-8 h-8 rounded-md flex items-center justify-center active:bg-white/10"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}

              <section>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Notiz an Bar / Küche
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="z.B. Allergie auf Nüsse, ohne Salz, sehr kalt…"
                  rows={3}
                  className="w-full glass rounded-xl p-3 text-sm bg-transparent outline-none resize-none placeholder:text-muted-foreground"
                />
              </section>

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border/40 flex items-center gap-3">
              <div className="flex items-center gap-1 glass rounded-xl p-1">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-lg flex items-center justify-center active:bg-white/10"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center text-lg font-semibold tabular-nums">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="w-10 h-10 rounded-lg flex items-center justify-center active:bg-white/10"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  onConfirm({
                    qty,
                    modifiers: [...mods, ...sideModifiers],
                    note: note.trim() || undefined,
                    priceDelta: +extrasDelta.toFixed(2),
                  });
                  onClose();
                }}
                className="flex-1 rounded-2xl py-3.5 bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-semibold shadow-[var(--shadow-gold)] tap-highlight-none"
              >
                Hinzufügen · CHF {(unitPrice * qty).toFixed(2)}
              </motion.button>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
