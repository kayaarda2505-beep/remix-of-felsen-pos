import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Music, Check, X, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { spotifyPlay, spotifySearch } from "@/lib/spotify.functions";

interface SongRequest {
  id: string;
  table_name: string | null;
  title: string;
  artist: string | null;
  note: string | null;
  status: string;
  created_at: string;
  spotify_uri: string | null;
  image_url: string | null;
}

export function SongRequestsPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"new" | "all">("new");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const play = useServerFn(spotifyPlay);
  const search = useServerFn(spotifySearch);

  const { data: songs = [], isLoading } = useQuery<SongRequest[]>({
    queryKey: ["song_requests", filter],
    queryFn: async () => {
      let q = supabase
        .from("song_requests")
        .select("id, table_name, title, artist, note, status, created_at, spotify_uri, image_url")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter === "new") q = q.eq("status", "new");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SongRequest[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`song_requests_panel_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "song_requests" },
        () => qc.invalidateQueries({ queryKey: ["song_requests"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const setStatus = async (id: string, status: "played" | "rejected") => {
    const { error } = await supabase.from("song_requests").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "played" ? "Als gespielt markiert" : "Abgelehnt");
    qc.invalidateQueries({ queryKey: ["song_requests"] });
  };

  const playSong = async (s: SongRequest) => {
    setPlayingId(s.id);
    try {
      let uri = s.spotify_uri;
      if (!uri) {
        const r = await search({ data: { q: `${s.title} ${s.artist ?? ""}`.trim() } });
        uri = r.tracks?.[0]?.uri ?? null;
        if (!uri) {
          toast.error("Kein Spotify-Treffer gefunden");
          return;
        }
      }
      await play({ data: { uri } });
      toast.success(`▶ ${s.title} läuft auf Spotify`);
      await setStatus(s.id, "played");
    } catch (e: any) {
      toast.error(e?.message ?? "Spotify-Abspielen fehlgeschlagen");
    } finally {
      setPlayingId(null);
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter("new")}
          className={`rounded-xl px-4 py-2 text-sm ${
            filter === "new" ? "bg-accent text-accent-foreground" : "bg-white/5 text-muted-foreground"
          }`}
        >
          Offen
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`rounded-xl px-4 py-2 text-sm ${
            filter === "all" ? "bg-accent text-accent-foreground" : "bg-white/5 text-muted-foreground"
          }`}
        >
          Alle
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : songs.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-muted-foreground text-sm bg-white/5">
          <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Keine Song-Wünsche
        </div>
      ) : (
        <div className="space-y-2">
          {songs.map((s) => (
            <div key={s.id} className="bg-white/5 rounded-2xl p-4 flex items-center gap-4">
              {s.image_url ? (
                <img src={s.image_url} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                  <Music className="w-4 h-4 text-accent" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {s.artist ? `${s.artist} · ` : ""}
                  Tisch {s.table_name ?? "—"} ·{" "}
                  {new Date(s.created_at).toLocaleTimeString("de-CH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                {s.note && (
                  <div className="text-xs italic text-muted-foreground mt-1 truncate">
                    „{s.note}"
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.status === "new" ? (
                  <>
                    <button
                      onClick={() => playSong(s)}
                      disabled={playingId === s.id}
                      className="rounded-xl bg-accent/15 hover:bg-accent/25 text-accent px-3 py-2 text-xs flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {playingId === s.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      Spielen
                    </button>
                    <button
                      onClick={() => setStatus(s.id, "played")}
                      className="rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 w-9 h-9 flex items-center justify-center"
                      title="Manuell als gespielt markieren"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setStatus(s.id, "rejected")}
                      className="rounded-xl bg-white/5 hover:bg-destructive/15 hover:text-destructive text-muted-foreground w-9 h-9 flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-lg ${
                      s.status === "played"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-white/5 text-muted-foreground"
                    }`}
                  >
                    {s.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
