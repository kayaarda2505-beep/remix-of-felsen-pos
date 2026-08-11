import { useEffect, useMemo, useRef, useState } from "react";

export type MapPinKind = "todo" | "enroute" | "courier";

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  kind: MapPinKind;
  label: string;
  sublabel?: string;
}

const PIN_COLORS: Record<MapPinKind, string> = {
  todo: "#f59e0b",
  enroute: "#38bdf8",
  courier: "#34d399",
};

declare global {
  interface Window {
    google?: any;
    __piratinoMapsReady?: boolean;
    __initPiratinoMaps?: () => void;
  }
}

let loadPromise: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
  loadPromise = new Promise<void>((resolve, reject) => {
    if (!key) {
      reject(new Error("Google Maps Schlüssel fehlt"));
      return;
    }
    window.__initPiratinoMaps = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initPiratinoMaps`;
    s.async = true;
    s.onerror = () => reject(new Error("Google Maps konnte nicht geladen werden"));
    document.head.appendChild(s);
  });
  return loadPromise;
}

function iconFor(kind: MapPinKind, google: any) {
  const color = PIN_COLORS[kind];
  const path =
    kind === "courier"
      ? "M12 2a6 6 0 0 1 6 6c0 4.5-6 14-6 14S6 12.5 6 8a6 6 0 0 1 6-6z"
      : "M12 2a6 6 0 0 1 6 6c0 4.5-6 14-6 14S6 12.5 6 8a6 6 0 0 1 6-6z";
  return {
    path,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#0b0b0d",
    strokeWeight: 1.5,
    scale: kind === "courier" ? 1.8 : 1.5,
    anchor: new google.maps.Point(12, 22),
  };
}

export function DeliveryMap({
  pins,
  onSelect,
  className = "",
}: {
  pins: MapPin[];
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const signature = useMemo(
    () => pins.map((p) => `${p.id}:${p.lat.toFixed(5)}:${p.lng.toFixed(5)}:${p.kind}`).join("|"),
    [pins],
  );

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !ref.current) return;
        const google = window.google;
        mapRef.current = new google.maps.Map(ref.current, {
          center: { lat: 47.3769, lng: 8.5417 },
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          styles: [
            { elementType: "geometry", stylers: [{ color: "#1b1b1f" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#1b1b1f" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#9aa0a6" }] },
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a30" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8f98" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#12161c" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        infoRef.current = new google.maps.InfoWindow();
        setReady(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Kartenfehler"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const google = window.google;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    pins.forEach((p) => {
      const marker = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map: mapRef.current,
        icon: iconFor(p.kind, google),
        title: p.label,
      });
      marker.addListener("click", () => {
        infoRef.current.setContent(
          `<div style="color:#111;font-size:12px;line-height:1.4"><strong>${p.label}</strong>${
            p.sublabel ? `<br/>${p.sublabel}` : ""
          }</div>`,
        );
        infoRef.current.open({ anchor: marker, map: mapRef.current });
        onSelect?.(p.id);
      });
      markersRef.current.push(marker);
      bounds.extend(marker.getPosition());
    });

    if (pins.length === 1) {
      mapRef.current.setCenter(bounds.getCenter());
      mapRef.current.setZoom(14);
    } else if (pins.length > 1) {
      mapRef.current.fitBounds(bounds, 64);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signature]);

  if (error) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted-foreground ${className}`}>
        {error}
      </div>
    );
  }

  return <div ref={ref} className={className} />;
}
