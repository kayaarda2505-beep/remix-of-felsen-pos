import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Music2, Unplug } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import {
  getSpotifyAuthUrl,
  getSpotifyConnection,
  disconnectSpotify,
} from "@/lib/spotify.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/spotify")({
  component: SpotifySettings,
});

function SpotifySettings() {
  const qc = useQueryClient();
  const authUrlFn = useServerFn(getSpotifyAuthUrl);
  const connFn = useServerFn(getSpotifyConnection);
  const disconnectFn = useServerFn(disconnectSpotify);

  const conn = useQuery({ queryKey: ["spotify-conn"], queryFn: () => connFn() });

  const connect = useMutation({
    mutationFn: async () => {
      const redirectUri = `${window.location.origin}/spotify-callback`;
      console.log("[Spotify] Connecting with redirectUri:", redirectUri);
      const { url } = await authUrlFn({ data: { redirectUri } });
      console.log("[Spotify] Auth URL:", url);
      window.location.href = url;
    },
    onError: (e: any) => {
      console.error("[Spotify] Connect error:", e);
      toast.error(e?.message || String(e) || "Unbekannter Fehler beim Verbinden");
    },
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectFn(),
    onSuccess: () => {
      toast.success("Spotify getrennt");
      qc.invalidateQueries({ queryKey: ["spotify-conn"] });
      qc.invalidateQueries({ queryKey: ["spotify-now"] });
    },
  });

  return (
    <div className="p-6 lg:p-10 pb-28 md:pb-10 max-w-2xl mx-auto">
      <Link to="/settings" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-6 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Einstellungen
      </Link>
      <PageHeader title="Spotify" subtitle="Bar-Musik direkt aus der App steuern" />

      <div className="glass rounded-3xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
            <Music2 className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <div className="font-medium">Globaler Bar-Account</div>
            <div className="text-xs text-muted-foreground">
              {conn.data?.connected ? "Verbunden" : "Nicht verbunden"}
            </div>
          </div>
        </div>

        {conn.data?.connected ? (
          <button
            onClick={() => disconnect.mutate()}
            className="w-full rounded-xl bg-destructive/15 hover:bg-destructive/25 text-destructive py-3 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Unplug className="w-4 h-4" /> Trennen
          </button>
        ) : (
          <button
            onClick={() => connect.mutate()}
            className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black py-3 text-sm font-semibold"
          >
            Mit Spotify verbinden
          </button>
        )}

        <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
          <p>• Steuere Wiedergabe direkt aus dem POS (Play/Pause/Skip/Volume).</p>
          <p>• Suche nach Songs & Playlists.</p>
          <p>• Wechsle das Wiedergabegerät (Bar-Speaker, Handy, Laptop).</p>
          <p className="pt-2">Hinweis: Für Steuerung wird Spotify Premium benötigt. Auf mindestens einem Gerät muss Spotify geöffnet sein.</p>
        </div>
      </div>
    </div>
  );
}
