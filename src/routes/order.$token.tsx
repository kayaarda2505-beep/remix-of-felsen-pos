import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Minus, ShoppingBag, Check, Loader2, Utensils, X, Music, Banknote, CreditCard, Wallet, Bell } from "lucide-react";
import { toast } from "sonner";

import { useProducts, type Product } from "@/hooks/use-products";
import { SaintsLogo } from "@/components/SaintsLogo";
import { getQrTable } from "@/lib/public-order.functions";
import { ProductModifierDialog, type ProductCustomization } from "@/components/ProductModifierDialog";
import { StripeTableCheckout } from "@/components/StripeTableCheckout";

export const Route = createFileRoute("/order/$token")({
  loader: async ({ params }) => {
    const { table } = await getQrTable({ data: { token: params.token } });
    if (!table) throw notFound();
    return { table };
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="glass rounded-3xl p-10 max-w-md text-center">
        <h1 className="text-2xl font-semibold mb-2">QR-Code ungültig</h1>
        <p className="text-sm text-muted-foreground">
          Dieser QR-Code ist nicht (mehr) gültig. Bitte frage das Personal nach einem neuen Code.
        </p>
      </div>
    </div>
  ),
  component: OrderPage,
});

type CartItem = { key: string; product: Product; qty: number; modifiers: string[]; note?: string };

const cartKey = (productId: string, modifiers: string[], note?: string) =>
  `${productId}|${[...modifiers].sort().join(",")}|${(note ?? "").trim()}`;

function OrderPage() {
  const { table } = Route.useLoaderData();
  const { token } = Route.useParams();
  const { products, categories } = useProducts();
  const [activeCat, setActiveCat] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [modProduct, setModProduct] = useState<Product | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [showStripe, setShowStripe] = useState(false);
  const [paySending, setPaySending] = useState(false);

  const requestPay = async (method: "cash" | "card_terminal") => {
    setPaySending(true);
    try {
      const res = await fetch("/api/public/payment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_token: token, method }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(method === "cash" ? "Service kommt mit der Rechnung 💵" : "Service bringt das EC-Gerät 💳");
      setShowPay(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    } finally {
      setPaySending(false);
    }
  };

  const [callingService, setCallingService] = useState(false);
  const callService = async () => {
    if (callingService) return;
    setCallingService(true);
    try {
      const res = await fetch("/api/public/service-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_token: token }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Service wurde gerufen 🔔", {
        description: "Ein Mitarbeiter kommt gleich zum Tisch.",
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    } finally {
      setTimeout(() => setCallingService(false), 30000);
    }
  };
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showSong, setShowSong] = useState(false);
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songNote, setSongNote] = useState("");
  const [songSending, setSongSending] = useState(false);
  const [songSuggestions, setSongSuggestions] = useState<Array<{ id: string; name: string; artists: string; image: string | null }>>([]);
  const [songSearching, setSongSearching] = useState(false);
  const [songPicked, setSongPicked] = useState<null | { id: string; image: string | null }>(null);

  useEffect(() => {
    if (songPicked) return;
    const q = songTitle.trim();
    if (q.length < 2) {
      setSongSuggestions([]);
      return;
    }
    setSongSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/public/spotify-search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const j = await res.json();
        setSongSuggestions(j.tracks ?? []);
      } catch {
        // ignore
      } finally {
        setSongSearching(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [songTitle, songPicked]);

  const submitSong = async () => {
    if (!songTitle.trim()) return toast.error("Bitte Songtitel angeben");
    setSongSending(true);
    try {
      const res = await fetch("/api/public/song-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr_token: token,
          title: songTitle.trim().slice(0, 200),
          artist: songArtist.trim().slice(0, 200) || null,
          note: songNote.trim().slice(0, 500) || null,
          spotify_track_id: songPicked?.id ?? null,
          spotify_uri: songPicked ? `spotify:track:${songPicked.id}` : null,
          image_url: songPicked?.image ?? null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Fehler");
      toast.success("Song-Wunsch ans DJ-Pult geschickt 🎶");
      setSongTitle("");
      setSongArtist("");
      setSongNote("");
      setShowSong(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler beim Senden");
    } finally {
      setSongSending(false);
    }
  };

  const effectiveCat = activeCat || categories[0] || "";
  const visible = useMemo(
    () => products.filter((p) => p.category === effectiveCat),
    [products, effectiveCat],
  );
  const total = cart.reduce((s, c) => s + c.product.price * c.qty, 0);
  const count = cart.reduce((s, c) => s + c.qty, 0);

  const addPlain = (p: Product) => {
    const key = cartKey(p.id, [], undefined);
    setCart((c) => {
      const ex = c.find((x) => x.key === key);
      if (ex) return c.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { key, product: p, qty: 1, modifiers: [] }];
    });
  };

  const addCustom = (p: Product, cust: ProductCustomization) => {
    const key = cartKey(p.id, cust.modifiers, cust.note);
    setCart((c) => {
      const ex = c.find((x) => x.key === key);
      if (ex) return c.map((x) => (x.key === key ? { ...x, qty: x.qty + cust.qty } : x));
      return [...c, { key, product: p, qty: cust.qty, modifiers: cust.modifiers, note: cust.note }];
    });
  };

  const incKey = (key: string) =>
    setCart((c) => c.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x)));
  const decKey = (key: string) =>
    setCart((c) =>
      c.map((x) => (x.key === key ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0),
    );

  const submit = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr_token: token,
          items: cart.map((c) => ({
            product_id: c.product.id,
            product_name: c.product.name,
            category: c.product.category,
            unit_price: c.product.price,
            qty: c.qty,
            note: c.note ?? null,
            modifiers: c.modifiers,
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSubmitted(true);
      setCart([]);
      setShowCart(false);
      toast.success("Bestellung übermittelt");
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler beim Senden");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (submitted) {
      const t = setTimeout(() => setSubmitted(false), 4000);
      return () => clearTimeout(t);
    }
  }, [submitted]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border/40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <SaintsLogo size={32} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tisch</div>
            <div className="font-semibold truncate">{table.name}</div>
          </div>
          <button
            onClick={callService}
            disabled={callingService}
            className="rounded-xl bg-accent/20 hover:bg-accent/30 w-10 h-10 flex items-center justify-center disabled:opacity-50"
            title="Service rufen"
          >
            {callingService ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4 text-accent" />}
          </button>
          <button
            onClick={() => setShowSong(true)}
            className="rounded-xl bg-white/5 hover:bg-white/10 w-10 h-10 flex items-center justify-center"
            title="Song wünschen"
          >
            <Music className="w-4 h-4 text-accent" />
          </button>
          <button
            onClick={() => setShowPay(true)}
            className="rounded-xl bg-white/5 hover:bg-white/10 w-10 h-10 flex items-center justify-center"
            title="Bezahlen"
          >
            <Wallet className="w-4 h-4 text-accent" />
          </button>
          <button
            onClick={() => setShowCart(true)}
            className="relative rounded-xl bg-accent/20 hover:bg-accent/30 px-4 py-2.5 text-sm flex items-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="tabular-nums">CHF {total.toFixed(2)}</span>
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
                {count}
              </span>
            )}
          </button>
        </div>
        {/* Categories */}
        <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-none">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs border transition-all ${
                effectiveCat === c
                  ? "bg-accent/20 border-accent/50 text-foreground"
                  : "border-transparent bg-white/5 text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </header>

      {/* Products */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-4 pb-32">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visible.map((p) => {
            const lines = cart.filter((c) => c.product.id === p.id);
            const totalQty = lines.reduce((s, l) => s + l.qty, 0);
            return (
              <motion.div
                key={p.id}
                layout
                className="glass rounded-2xl p-4 flex items-center gap-3"
              >
                <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Utensils className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  {p.description && (
                    <div className="text-[11px] text-muted-foreground truncate">{p.description}</div>
                  )}
                  <div className="text-xs tabular-nums mt-0.5">CHF {p.price.toFixed(2)}</div>
                </div>
                {totalQty > 0 && (
                  <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-semibold flex items-center justify-center tabular-nums">
                    {totalQty}
                  </span>
                )}
                <button
                  onClick={() => setModProduct(p)}
                  className="w-9 h-9 rounded-xl bg-accent/20 hover:bg-accent/30 flex items-center justify-center"
                  aria-label="Hinzufügen"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </main>

      {/* Sticky bottom bar */}
      {count > 0 && !showCart && (
        <div className="fixed bottom-4 left-0 right-0 px-4 z-20">
          <button
            onClick={() => setShowCart(true)}
            className="max-w-3xl mx-auto w-full rounded-2xl bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground py-3.5 font-semibold flex items-center justify-center gap-2 shadow-[var(--shadow-gold)]"
          >
            <ShoppingBag className="w-4 h-4" />
            {count} Artikel · CHF {total.toFixed(2)} bestellen
          </button>
        </div>
      )}

      {/* Cart drawer */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCart(false)}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="p-5 flex items-center justify-between border-b border-white/10">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tisch {table.name}</div>
                  <h2 className="text-lg font-semibold">Deine Bestellung</h2>
                </div>
                <button onClick={() => setShowCart(false)} className="w-9 h-9 rounded-xl glass flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-2">
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Noch leer.</p>
                ) : (
                  cart.map((c) => (
                    <div key={c.key} className="flex items-start gap-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{c.product.name}</div>
                        {c.modifiers.length > 0 && (
                          <div className="text-[11px] text-accent/90 truncate mt-0.5">
                            {c.modifiers.join(" · ")}
                          </div>
                        )}
                        {c.note && (
                          <div className="text-[11px] text-muted-foreground italic truncate mt-0.5">
                            „{c.note}"
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                          CHF {c.product.price.toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <button onClick={() => decKey(c.key)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center tabular-nums text-sm">{c.qty}</span>
                        <button onClick={() => incKey(c.key)} className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="w-16 text-right tabular-nums text-sm mt-1">
                        CHF {(c.product.price * c.qty).toFixed(2)}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-5 border-t border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">Summe</span>
                  <span className="font-semibold tabular-nums">CHF {total.toFixed(2)}</span>
                </div>
                <button
                  onClick={submit}
                  disabled={submitting || cart.length === 0}
                  className="w-full rounded-2xl py-3.5 bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Bestellen</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Song wish modal */}
      <AnimatePresence>
        {showSong && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSong(false)}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-3xl w-full max-w-md overflow-hidden"
            >
              <div className="p-5 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center">
                    <Music className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Tisch {table.name}
                    </div>
                    <h2 className="text-lg font-semibold">Song wünschen</h2>
                  </div>
                </div>
                <button
                  onClick={() => setShowSong(false)}
                  className="w-9 h-9 rounded-xl glass flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Songtitel *
                  </label>
                  <input
                    value={songTitle}
                    onChange={(e) => {
                      setSongTitle(e.target.value);
                      setSongPicked(null);
                    }}
                    maxLength={200}
                    placeholder="z.B. Dracula"
                    className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-accent/50"
                  />
                  {!songPicked && songSuggestions.length > 0 && (
                    <div className="mt-2 rounded-xl border border-white/10 bg-black/40 backdrop-blur overflow-hidden max-h-64 overflow-y-auto">
                      {songSuggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSongTitle(s.name);
                            setSongArtist(s.artists);
                            setSongPicked({ id: s.id, image: s.image });
                            setSongSuggestions([]);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 text-left"
                        >
                          {s.image ? (
                            <img src={s.image} alt="" className="w-10 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center">
                              <Music className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{s.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{s.artists}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {songSearching && !songPicked && (
                    <div className="mt-1 text-[11px] text-muted-foreground">Suche auf Spotify…</div>
                  )}
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Künstler
                  </label>
                  <input
                    value={songArtist}
                    onChange={(e) => setSongArtist(e.target.value)}
                    maxLength={200}
                    placeholder="z.B. The Weeknd"
                    className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-accent/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Nachricht (optional)
                  </label>
                  <textarea
                    value={songNote}
                    onChange={(e) => setSongNote(e.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder="z.B. für meine Freundin 💛"
                    className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent/50 resize-none"
                  />
                </div>
              </div>
              <div className="p-5 border-t border-white/10">
                <button
                  onClick={submitSong}
                  disabled={songSending || !songTitle.trim()}
                  className="w-full rounded-2xl py-3.5 bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {songSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Music className="w-4 h-4" /> Wunsch senden
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Success toast */}
      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 top-20 z-50 flex justify-center px-4 pointer-events-none"
          >
            <div className="glass-strong rounded-2xl px-5 py-3 flex items-center gap-2 text-sm">
              <div className="w-7 h-7 rounded-full bg-success/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-success" />
              </div>
              Bestellung wurde an die Bar geschickt.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProductModifierDialog
        product={modProduct}
        open={!!modProduct}
        onClose={() => setModProduct(null)}
        onConfirm={(c) => {
          if (modProduct) addCustom(modProduct, c);
          setModProduct(null);
        }}
      />

      <AnimatePresence>
        {showPay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPay(false)}
            className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-3xl w-full max-w-md p-5 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tisch {table.name}</div>
                  <h2 className="text-lg font-semibold">Bezahlen</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Wie möchtest du bezahlen? Der Service kommt zu deinem Tisch.
                  </p>
                </div>
                <button onClick={() => setShowPay(false)} className="w-9 h-9 rounded-xl glass flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <button
                disabled={paySending}
                onClick={() => requestPay("cash")}
                className="w-full glass rounded-2xl p-4 flex items-center gap-3 hover:bg-white/5 disabled:opacity-50"
              >
                <div className="w-11 h-11 rounded-xl bg-accent/20 text-accent flex items-center justify-center">
                  <Banknote className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Bar</div>
                  <div className="text-[11px] text-muted-foreground">Service bringt die Rechnung</div>
                </div>
              </button>
              <button
                disabled={paySending}
                onClick={() => requestPay("card_terminal")}
                className="w-full glass rounded-2xl p-4 flex items-center gap-3 hover:bg-white/5 disabled:opacity-50"
              >
                <div className="w-11 h-11 rounded-xl bg-accent/20 text-accent flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-medium">EC-Gerät am Tisch</div>
                  <div className="text-[11px] text-muted-foreground">Service kommt mit dem Kartenlesegerät</div>
                </div>
              </button>
              <button
                disabled={paySending}
                onClick={() => {
                  setShowPay(false);
                  setShowStripe(true);
                }}
                className="w-full rounded-2xl p-4 flex items-center gap-3 bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground disabled:opacity-50"
              >
                <div className="w-11 h-11 rounded-xl bg-black/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">Jetzt online bezahlen</div>
                  <div className="text-[11px] opacity-80">Karte, Apple Pay, Google Pay – sofort</div>
                </div>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStripe && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="w-full max-w-md my-8"
            >
              <div className="flex items-center justify-between mb-3 text-white">
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70">Tisch {table.name}</div>
                  <h2 className="text-lg font-semibold">Online bezahlen</h2>
                </div>
                <button
                  onClick={() => setShowStripe(false)}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <StripeTableCheckout
                qrToken={token}
                returnUrl={`${window.location.origin}/order/${token}/paid?session_id={CHECKOUT_SESSION_ID}`}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
