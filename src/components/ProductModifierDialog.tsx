import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { X, Minus, Plus, Check } from "lucide-react";
import type { ModifierGroup, Product } from "@/hooks/use-products";

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


export interface ProductCustomization {
  qty: number;
  modifiers: string[];
  note?: string;
}

export function ProductModifierDialog({
  product,
  open,
  onClose,
  onConfirm,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (c: ProductCustomization) => void;
}) {
  const [qty, setQty] = useState(1);
  const [mods, setMods] = useState<string[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setQty(1);
      setMods([]);
      setNote("");
    }
  }, [open, product?.id]);

  const toggle = (m: string) =>
    setMods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

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
                  onConfirm({ qty, modifiers: mods, note: note.trim() || undefined });
                  onClose();
                }}
                className="flex-1 rounded-2xl py-3.5 bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-semibold shadow-[var(--shadow-gold)] tap-highlight-none"
              >
                Hinzufügen · CHF {(product.price * qty).toFixed(2)}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
