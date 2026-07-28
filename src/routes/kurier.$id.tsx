import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bike, Check, Loader2, MapPin, Navigation, Phone, StickyNote } from "lucide-react";

import { getCourierOrder, startCourierDelivery } from "@/lib/courier.functions";

export const Route = createFileRoute("/kurier/$id")({
  head: () => ({
    meta: [
      { title: "Lieferauftrag — Piratino Kurier" },
      { name: "description", content: "Alle Angaben zur Lieferung: Adresse, Navigation, Telefon und Bestellung." },
      { property: "og:title", content: "Lieferauftrag — Piratino Kurier" },
      { property: "og:description", content: "Adresse, Navigation, Telefon und Bestelldetails für den Kurier." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CourierPage,
});

function isApple() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
}

function CourierPage() {
  const { id } = Route.useParams();
  const fetchOrder = useServerFn(getCourierOrder);
  const startDelivery = useServerFn(startCourierDelivery);
  const qc = useQueryClient();

  const start = useMutation({
    mutationFn: () => startDelivery({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courier-order", id] }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["courier-order", id],
    queryFn: () => fetchOrder({ data: { id } }),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const order = data?.order;
  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold mb-1">Lieferauftrag nicht gefunden</h1>
          <p className="text-sm text-muted-foreground">Bitte den QR-Code erneut scannen.</p>
        </div>
      </div>
    );
  }

  const c = order.customer;
  const addressLine = c
    ? `${c.street} ${c.house_no}, ${c.zip} ${c.city}`.replace(/\s+/g, " ").trim()
    : (order.delivery_address ?? "");
  const mapsQuery = encodeURIComponent(addressLine);
  const mapsUrl = isApple()
    ? `https://maps.apple.com/?daddr=${mapsQuery}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`;
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`;
  const appleUrl = `https://maps.apple.com/?daddr=${mapsQuery}&dirflg=d`;
  const phone = c?.phone?.replace(/[^+0-9]/g, "") ?? "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto p-4 space-y-4 pb-10">
        <header className="flex items-center gap-2 pt-2">
          <div className="w-10 h-10 rounded-xl glass flex items-center justify-center">
            <Bike className="w-5 h-5 text-accent" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Piratino Lieferung</div>
            <h1 className="text-lg font-semibold truncate">#{order.id.slice(0, 8).toUpperCase()}</h1>
          </div>
          <span
            className={`ml-auto text-[11px] px-2.5 py-1 rounded-full ${
              order.paid > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
            }`}
          >
            {order.paid > 0
              ? `Bezahlt${order.payment_method === "cash" ? " (Bar)" : order.payment_method ? " (Karte)" : ""}`
              : "Bar kassieren"}
          </span>
        </header>

        <section className="glass-strong rounded-3xl p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Lieferadresse</div>
          {c?.name && <div className="text-base font-semibold">{c.name}</div>}
          <div className="text-base flex items-start gap-2 mt-1">
            <MapPin className="w-4 h-4 mt-1 shrink-0 text-accent" />
            <span>{addressLine || "—"}</span>
          </div>
          {c?.note && (
            <div className="text-sm text-muted-foreground flex items-start gap-2 mt-2">
              <StickyNote className="w-4 h-4 mt-0.5 shrink-0" /> {c.note}
            </div>
          )}
          {order.delivery_note && (
            <div className="text-sm text-accent flex items-start gap-2 mt-2">
              <StickyNote className="w-4 h-4 mt-0.5 shrink-0" /> {order.delivery_note}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-4">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl py-3 bg-accent/15 text-accent flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Navigation className="w-4 h-4" /> Navigation
            </a>
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="rounded-xl py-3 glass flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Phone className="w-4 h-4" /> Anrufen
              </a>
            ) : (
              <div className="rounded-xl py-3 glass flex items-center justify-center gap-2 text-sm opacity-40">
                <Phone className="w-4 h-4" /> Keine Nummer
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
            <a href={googleUrl} target="_blank" rel="noreferrer" className="rounded-lg py-2 glass text-center">
              Google Maps
            </a>
            <a href={appleUrl} target="_blank" rel="noreferrer" className="rounded-lg py-2 glass text-center">
              Apple Maps
            </a>
          </div>
          {c?.phone && <div className="text-center text-xs text-muted-foreground mt-2">{c.phone}</div>}
        </section>

        <section className="glass-strong rounded-3xl p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Bestellung</div>
          <div className="space-y-2">
            {order.items.map((i) => (
              <div key={i.id} className="flex items-start gap-3 text-sm">
                <span className="w-7 text-accent font-semibold tabular-nums">{i.qty}×</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{i.name}</div>
                  {i.note && <div className="text-xs text-muted-foreground">{i.note}</div>}
                </div>
                <span className="tabular-nums">{(i.qty * i.unit_price).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 mt-4 pt-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-semibold tabular-nums">
              CHF {(order.total || order.items.reduce((s, i) => s + i.qty * i.unit_price, 0)).toFixed(2)}
            </span>
          </div>
          {order.courier_started_at ? (
            <div className="mt-4 rounded-2xl bg-emerald-500/10 text-emerald-400 text-sm px-3 py-3 text-center flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> Lieferung gestartet
            </div>
          ) : (
            <button
              onClick={() => start.mutate()}
              disabled={start.isPending}
              className="mt-4 w-full rounded-2xl py-4 bg-accent text-accent-foreground font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {start.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bike className="w-4 h-4" />}
              Lieferung beginnen
            </button>
          )}

          {order.paid <= 0 && (
            <div className="mt-3 rounded-xl bg-amber-500/10 text-amber-400 text-sm px-3 py-2 text-center">
              Betrag beim Kunden kassieren
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
