import { createFileRoute, Link } from "@tanstack/react-router";
import { Music2, Speaker, CheckCircle2, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { useBarSpeaker } from "@/components/SpotifyBarSpeaker";
import { toast } from "sonner";

export const Route = createFileRoute("/spotify-player")({
  component: SpotifyPlayerPage,
});

function SpotifyPlayerPage() {
  const { status, error, isActive, connected, enabled, setEnabled, makeActive } = useBarSpeaker();

  const onActivate = async () => {
    try {
      await makeActive();
      toast.success("Wiedergabe auf PC-Lautsprecher übertragen");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-6 lg:p-10 pb-28 md:pb-10 max-w-2xl mx-auto">
      <Link
        to="/settings/spotify"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-6 hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Spotify Einstellungen
      </Link>
      <PageHeader title="PC-Lautsprecher" subtitle="Dieses Gerät als Spotify-Wiedergabegerät nutzen" />

      <div className="glass rounded-3xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
            <Speaker className="w-7 h-7 text-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="font-medium">SAINTS POS – Bar Lautsprecher</div>
            <div className="text-xs text-muted-foreground">
              {!enabled && "Deaktiviert"}
              {enabled && status === "loading" && "Verbinde…"}
              {enabled && status === "ready" && (isActive ? "Aktiv – spielt über PC-Lautsprecher" : "Bereit")}
              {enabled && status === "error" && error}
              {enabled && status === "idle" && connected === false && "Erst Spotify verbinden"}
            </div>
          </div>
          {enabled && status === "loading" && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
          {enabled && status === "ready" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {enabled && status === "error" && <AlertCircle className="w-5 h-5 text-destructive" />}
        </div>

        {connected === false && (
          <Link
            to="/settings/spotify"
            className="block w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black py-3 text-sm font-semibold text-center"
          >
            <Music2 className="w-4 h-4 inline mr-2" />
            Spotify verbinden
          </Link>
        )}

        <label className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3">
          <div>
            <div className="text-sm font-medium">Bar-Lautsprecher aktiv halten</div>
            <div className="text-[11px] text-muted-foreground">
              Läuft im Hintergrund während du durch die App navigierst.
            </div>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-5 h-5 accent-emerald-500"
          />
        </label>

        {enabled && status === "ready" && (
          <button
            onClick={onActivate}
            disabled={isActive}
            className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/5 disabled:text-muted-foreground text-black py-3 text-sm font-semibold"
          >
            {isActive ? "Aktives Gerät" : "Auf PC-Lautsprecher übertragen"}
          </button>
        )}

        <div className="text-xs text-muted-foreground leading-relaxed space-y-2 pt-2 border-t border-white/5">
          <p className="font-medium text-foreground">So funktioniert's:</p>
          <p>1. Schalter oben aktiviert → der PC ist dauerhaft als Spotify-Gerät verfügbar.</p>
          <p>2. „Auf PC-Lautsprecher übertragen" klicken.</p>
          <p>3. Du kannst die Seite verlassen – Musik läuft weiter, solange der POS-Tab offen ist.</p>
          <p className="pt-2 text-amber-300/80">
            ⚠ Spotify Premium erforderlich. Wenn du den ganzen Browser-Tab/Fenster schließt, stoppt die Wiedergabe (Spotify-Limit).
          </p>
        </div>
      </div>
    </div>
  );
}
