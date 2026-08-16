import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";
import { Bike, Clock, Loader2, MapPin, PartyPopper } from "lucide-react";

import { DeliveryMap, type MapPin as Pin } from "@/components/DeliveryMap";
import { getTracking } from "@/lib/tracking.functions";


export const Route = createFileRoute("/track/$token")({
  head: () => ({
    meta: [
      { title: "Lieferung verfolgen — Piratino" },
      { name: "description", content: "Live-Standort des Kuriers und geschätzte Ankunftszeit deiner Piratino-Bestellung." },
      { property: "og:title", content: "Lieferung verfolgen — Piratino" },
      { property: "og:description", content: "Live-Standort des Kuriers und geschätzte Ankunftszeit deiner Bestellung." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

function TrackPage() {
  const { token } = Route.useParams();
  const fetchTracking = useServerFn(getTracking);
  const [route, setRoute] = useState<{ km: number; minutes: number } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["tracking", token],
    queryFn: () => fetchTracking({ data: { token } }),
    refetchInterval: 15_000,
  });

  const handleRouteInfo = useCallback((_id: string, info: { km: number; minutes: number }) => {
    setRoute((prev) => (prev?.km === info.km && prev?.minutes === info.minutes ? prev : info));
  }, []);



  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const t = data?.tracking;
  if (!t) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold mb-1">Lieferung nicht gefunden</h1>
          <p className="text-sm text-muted-foreground">Bitte den Link aus der SMS erneut öffnen.</p>
        </div>
      </div>
    );
  }

  const pins: Pin[] = [];
  if (t.destination) pins.push({ id: "dest", ...t.destination, kind: "todo", label: "Lieferadresse", sublabel: t.address ?? undefined });
  if (t.courier) pins.push({ id: "courier", lat: t.courier.lat, lng: t.courier.lng, kind: "courier", label: t.courierName ?? "Kurier" });

  const mapRoutes =
    t.courier && t.destination
      ? [{ id: "delivery", from: { lat: t.courier.lat, lng: t.courier.lng }, to: t.destination }]
      : [];

  const etaMinutes = route?.minutes ?? t.etaMinutes;
  const distanceKm = route?.km ?? t.distanceKm;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto p-4 space-y-4">
        <header className="flex items-center gap-2 pt-2">
          <div className="w-10 h-10 rounded-xl glass flex items-center justify-center">
            <Bike className="w-5 h-5 text-accent" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Piratino</div>
            <h1 className="text-lg font-semibold">
              {t.status === "delivered" ? "Geliefert" : t.status === "enroute" ? "Kurier unterwegs" : "In Zubereitung"}
            </h1>
          </div>
        </header>

        {t.status === "delivered" ? (
          <div className="glass-strong rounded-3xl p-5 flex items-center gap-3 text-emerald-400">
            <PartyPopper className="w-5 h-5" /> Guten Appetit!
          </div>
        ) : (
          <div className="glass-strong rounded-3xl p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" /> Geschätzte Ankunft
            </div>
            <div className="text-3xl font-semibold mt-1">
              {etaMinutes ? `ca. ${etaMinutes} Min.` : "wird berechnet …"}
            </div>
            {distanceKm != null && (
              <div className="text-xs text-muted-foreground mt-1">noch {distanceKm.toFixed(1)} km entfernt</div>
            )}
            {t.courierName && <div className="text-sm mt-2">Kurier: {t.courierName}</div>}
          </div>
        )}

        {pins.length > 0 && (
          <DeliveryMap
            pins={pins}
            routes={mapRoutes}
            onRouteInfo={handleRouteInfo}
            className="w-full h-[55dvh] rounded-3xl overflow-hidden"
          />
        )}


        <div className="glass-strong rounded-3xl p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Lieferadresse</div>
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 mt-0.5 text-accent shrink-0" />
            <span>{t.address ?? "—"}</span>
          </div>
          <div className="border-t border-white/10 mt-4 pt-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-xl font-semibold tabular-nums">CHF {t.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
