import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { exchangeSpotifyCode } from "@/lib/spotify.functions";

export const Route = createFileRoute("/spotify-callback")({
  component: SpotifyCallback,
});

function SpotifyCallback() {
  const exchange = useServerFn(exchangeSpotifyCode);
  const navigate = useNavigate();
  const router = useRouter();
  const [status, setStatus] = useState("Verbinde mit Spotify…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const err = params.get("error");
    if (err) {
      setStatus(`Fehler: ${err}`);
      return;
    }
    if (!code) {
      setStatus("Kein Code erhalten.");
      return;
    }
    const redirectUri = `${window.location.origin}/spotify-callback`;
    exchange({ data: { code, redirectUri } })
      .then(() => {
        setStatus("Verbunden. Weiterleitung…");
        router.invalidate();
        setTimeout(() => navigate({ to: "/settings" }), 600);
      })
      .catch((e) => setStatus(`Fehler: ${e.message}`));
  }, [exchange, navigate, router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass rounded-3xl p-10 text-center max-w-md">
        <h1 className="text-xl font-semibold">Spotify</h1>
        <p className="mt-3 text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
