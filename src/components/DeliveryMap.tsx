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

function svgIcon(kind: MapPinKind, google: any) {
  const color = PIN_COLORS[kind];
  const glyph =
    kind === "courier"
      ? // Auto
        `<path d="M13 30h30l-3.5-9.5A4 4 0 0 0 35.8 18H20.2a4 4 0 0 0-3.7 2.5L13 30z" fill="#fff"/>
         <rect x="9" y="30" width="38" height="10" rx="3" fill="#fff"/>
         <circle cx="18" cy="41" r="3.5" fill="#111"/><circle cx="38" cy="41" r="3.5" fill="#111"/>`
      : // Box / Paket
        `<path d="M28 13l15 7-15 7-15-7 15-7z" fill="#fff"/>
         <path d="M13 22v13l15 7V29l-15-7z" fill="#fff" opacity="0.85"/>
         <path d="M43 22v13l-15 7V29l15-7z" fill="#fff" opacity="0.7"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="70" viewBox="0 0 56 70">
    <path d="M28 68C28 68 52 42 52 26A24 24 0 1 0 4 26C4 42 28 68 28 68Z" fill="${color}" stroke="#0b0b0d" stroke-width="2.5"/>
    <g transform="translate(0,-2)">${glyph}</g>
  </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(kind === "courier" ? 50 : 42, kind === "courier" ? 62 : 52),
    anchor: new google.maps.Point(kind === "courier" ? 25 : 21, kind === "courier" ? 62 : 52),
  };
}


export interface MapRoute {
  id: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}

export interface RouteInfo {
  km: number;
  minutes: number;
}

export function DeliveryMap({
  pins,
  routes = [],
  onRouteInfo,
  onSelect,
  className = "",
}: {
  pins: MapPin[];
  routes?: MapRoute[];
  onRouteInfo?: (id: string, info: RouteInfo) => void;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoRef = useRef<any>(null);
  const routeLinesRef = useRef<any[]>([]);
  const routeCacheRef = useRef<Record<string, { path: any[]; info: RouteInfo }>>({});
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const signature = useMemo(
    () => pins.map((p) => `${p.id}:${p.lat.toFixed(5)}:${p.lng.toFixed(5)}:${p.kind}`).join("|"),
    [pins],
  );

  const routeSignature = useMemo(
    () =>
      routes
        .map(
          (r) =>
            `${r.id}:${r.from.lat.toFixed(4)},${r.from.lng.toFixed(4)}>${r.to.lat.toFixed(4)},${r.to.lng.toFixed(4)}`,
        )
        .join("|"),
    [routes],
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
          mapTypeId: google.maps.MapTypeId.HYBRID,
          tilt: 0,
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
        icon: svgIcon(p.kind, google),
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
