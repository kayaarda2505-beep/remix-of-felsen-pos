import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GeoState = "idle" | "on" | "denied" | "error" | "unsupported";

/**
 * Sendet den Live-Standort des Kuriers laufend (watchPosition + Heartbeat alle 10 s),
 * hält den Bildschirm wach (Wake Lock) und sendet sofort neu, wenn die App wieder sichtbar wird.
 */
export function useCourierGeo(courierId: string | null | undefined) {
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!courierId) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoState("unsupported");
      setGeoMsg("Dieses Gerät/Browser unterstützt keine Standortfreigabe.");
      return;
    }
    if (!window.isSecureContext) {
      setGeoState("error");
      setGeoMsg("Standort geht nur über eine sichere HTTPS-Verbindung.");
      return;
    }

    let lastSent = 0;
    const send = (pos: GeolocationPosition) => {
      const now = Date.now();
      if (now - lastSent < 3000) return;
      lastSent = now;
      void (async () => {
        const { error } = await (supabase.from("courier_locations") as any).upsert(
          {
            member_id: courierId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "member_id" },
        );
        if (error) {
          setGeoState("error");
          setGeoMsg(`Standort konnte nicht gesendet werden: ${error.message}`);
        } else {
          setGeoState("on");
          setGeoMsg("Bildschirm bleibt an, damit der Standort live bleibt. App bitte offen lassen.");
        }
      })();
    };
    const onErr = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setGeoState("denied");
        setGeoMsg("Standort wurde blockiert. In den Browser-Einstellungen für diese Seite erlauben.");
      } else if (err.code !== err.TIMEOUT) {
        setGeoState("error");
        setGeoMsg(err.message || "Standort konnte nicht ermittelt werden.");
      }
    };
    const opts: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 };
    const poll = () => navigator.geolocation.getCurrentPosition(send, onErr, opts);

    poll();
    const watchId = navigator.geolocation.watchPosition(send, onErr, opts);
    const heartbeat = window.setInterval(poll, 10_000);

    // Bildschirm wach halten — sonst stoppt der Browser die Standortabfrage
    let wakeLock: any = null;
    const requestWake = async () => {
      try {
        wakeLock = await (navigator as any).wakeLock?.request("screen");
      } catch {
        /* ignorieren */
      }
    };
    void requestWake();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void requestWake();
        lastSent = 0;
        poll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisible);
      try {
        wakeLock?.release?.();
      } catch {
        /* ignorieren */
      }
    };
  }, [courierId, tick]);

  return { geoState, geoMsg, retry: () => setTick((t) => t + 1) };
}
