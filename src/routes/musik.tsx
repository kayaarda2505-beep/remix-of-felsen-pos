import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  Search,
  Speaker,
  Shuffle,
  Repeat,
  ListPlus,
  ArrowLeft,
  Music2,
  ListMusic,
  Clock,
  Sparkles,
  Bell,
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { SongRequestsPanel } from "@/components/SongRequestsPanel";
import {
  getNowPlaying,
  getSpotifyDevices,
  getSpotifyConnection,
  spotifyPlay,
  spotifyPause,
  spotifyNext,
  spotifyPrev,
  spotifyVolume,
  spotifySearch,
  spotifyTransfer,
  spotifyShuffle,
  spotifyRepeat,
  spotifyQueue,
  getMyPlaylists,
  getFeaturedPlaylists,
  getPlaylistTracks,
  getRecentlyPlayed,
} from "@/lib/spotify.functions";
import { toast } from "sonner";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/musik")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: (s.tab as Tab) ?? undefined,
  }),
  component: MusikPage,
});

type Tab = "now" | "playlists" | "search" | "devices" | "wuensche";

function MusikPage() {
  const qc = useQueryClient();
  const initialTab = (Route.useSearch() as any).tab as Tab | undefined;
  const [tab, setTab] = useState<Tab>(initialTab ?? "now");
  const [query, setQuery] = useState("");
  const [activePlaylist, setActivePlaylist] = useState<{ id: string; uri: string; name: string } | null>(null);

  const nowFn = useServerFn(getNowPlaying);
  const devicesFn = useServerFn(getSpotifyDevices);
  const connFn = useServerFn(getSpotifyConnection);
  const playFn = useServerFn(spotifyPlay);
  const pauseFn = useServerFn(spotifyPause);
  const nextFn = useServerFn(spotifyNext);
  const prevFn = useServerFn(spotifyPrev);
  const volFn = useServerFn(spotifyVolume);
  const searchFn = useServerFn(spotifySearch);
  const transferFn = useServerFn(spotifyTransfer);
  const shuffleFn = useServerFn(spotifyShuffle);
  const repeatFn = useServerFn(spotifyRepeat);
  const queueFn = useServerFn(spotifyQueue);
  const myPlaylistsFn = useServerFn(getMyPlaylists);
  const featuredFn = useServerFn(getFeaturedPlaylists);
  const playlistTracksFn = useServerFn(getPlaylistTracks);
  const recentFn = useServerFn(getRecentlyPlayed);

  const conn = useQuery({ queryKey: ["spotify-conn"], queryFn: () => connFn() });
  const connected = !!conn.data?.connected;

  const np = useQuery({
    queryKey: ["spotify-now"],
    queryFn: () => nowFn(),
    refetchInterval: 4000,
    enabled: connected,
  });
  const devices = useQuery({
    queryKey: ["spotify-devices"],
    queryFn: () => devicesFn(),
    enabled: connected && tab === "devices",
    refetchInterval: tab === "devices" ? 5000 : false,
  });
  const myPls = useQuery({
    queryKey: ["spotify-my-playlists"],
    queryFn: () => myPlaylistsFn(),
    enabled: connected && tab === "playlists",
  });
  const featured = useQuery({
    queryKey: ["spotify-featured"],
    queryFn: () => featuredFn(),
    enabled: connected && tab === "playlists",
  });
  const recent = useQuery({
    queryKey: ["spotify-recent"],
    queryFn: () => recentFn(),
    enabled: connected && tab === "now",
  });
  const search = useQuery({
    queryKey: ["spotify-search", query],
    queryFn: () => searchFn({ data: { q: query } }),
    enabled: connected && tab === "search" && query.trim().length > 1,
  });
  const plTracks = useQuery({
    queryKey: ["spotify-pl-tracks", activePlaylist?.id],
    queryFn: () => playlistTracksFn({ data: { playlistId: activePlaylist!.id } }),
    enabled: !!activePlaylist,
  });
  const openWishes = useQuery({
    queryKey: ["song_requests_open_count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("song_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      return count ?? 0;
    },
    refetchInterval: 10000,
  });
  useEffect(() => {
    const ch = supabase
      .channel(`musik_song_requests_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "song_requests" },
        () => qc.invalidateQueries({ queryKey: ["song_requests_open_count"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
  const openWishCount = openWishes.data ?? 0;

  const invalidateNow = () => qc.invalidateQueries({ queryKey: ["spotify-now"] });

  const run = async (fn: () => Promise<any>, successMsg?: string) => {
    try {
      const r = await fn();
      if (r?.ok === false && r?.error) {
        toast.error(r.error);
        return;
      }
      if (successMsg) toast.success(successMsg);
      invalidateNow();
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    }
  };

  if (!connected) {
    return (
      <div className="p-6 lg:p-10 max-w-2xl mx-auto">
        <PageHeader title="Musik" subtitle="Spotify Control Center" />
        <div className="glass rounded-3xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto">
            <Music2 className="w-8 h-8 text-emerald-400" />
          </div>
          <p className="text-muted-foreground">Spotify ist noch nicht verbunden.</p>
          <Link
            to="/settings/spotify"
            className="inline-block rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-3 text-sm font-semibold"
          >
            Mit Spotify verbinden
          </Link>
        </div>
      </div>
    );
  }

  const track = np.data?.track;
  const volume = np.data?.volume ?? 50;
  const playing = np.data?.playing;

  return (
    <div className="p-6 lg:p-10 pb-28 md:pb-10 max-w-5xl mx-auto">
      <PageHeader title="Musik" subtitle="Spotify Control Center für die Bar" />

      {/* Now Playing Hero */}
      <div className="glass rounded-3xl p-6 mb-6 flex flex-col md:flex-row gap-6 items-center">
        <div className="w-40 h-40 rounded-2xl bg-white/5 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {track?.image ? (
            <img src={track.image} alt="" className="w-full h-full object-cover" />
          ) : (
            <Music2 className="w-16 h-16 text-white/20" />
          )}
        </div>
        <div className="flex-1 w-full text-center md:text-left">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            {playing ? "Spielt jetzt" : "Pausiert"}
          </div>
          <div className="text-2xl font-semibold truncate">{track?.name ?? "—"}</div>
          <div className="text-sm text-muted-foreground truncate">{track?.artists ?? ""}</div>
          {np.data?.device && (
            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center md:justify-start gap-1">
              <Speaker className="w-3 h-3" /> {np.data.device.name}
            </div>
          )}

          <div className="flex items-center justify-center md:justify-start gap-2 mt-4">
            <button onClick={() => run(() => shuffleFn({ data: { state: true } }), "Shuffle an")} className="p-2 rounded-full hover:bg-white/10" title="Shuffle">
              <Shuffle className="w-4 h-4" />
            </button>
            <button onClick={() => run(() => prevFn())} className="p-3 rounded-full bg-white/5 hover:bg-white/10">
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={() => run(playing ? () => pauseFn() : () => playFn({ data: {} }))}
              className="p-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black"
            >
              {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <button onClick={() => run(() => nextFn())} className="p-3 rounded-full bg-white/5 hover:bg-white/10">
              <SkipForward className="w-5 h-5" />
            </button>
            <button onClick={() => run(() => repeatFn({ data: { state: "context" } }), "Repeat: Playlist")} className="p-2 rounded-full hover:bg-white/10" title="Repeat">
              <Repeat className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 mt-4 max-w-xs mx-auto md:mx-0">
            <Volume2 className="w-4 h-4 text-muted-foreground" />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                qc.setQueryData(["spotify-now"], (old: any) => (old ? { ...old, volume: v } : old));
              }}
              onMouseUp={(e) => run(() => volFn({ data: { volume: Number((e.target as HTMLInputElement).value) } }))}
              onTouchEnd={(e) => run(() => volFn({ data: { volume: Number((e.target as HTMLInputElement).value) } }))}
              className="flex-1 accent-emerald-500"
            />
            <span className="text-xs text-muted-foreground w-8 text-right">{volume}%</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        <TabBtn active={tab === "now"} onClick={() => setTab("now")} icon={<Clock className="w-4 h-4" />}>Zuletzt gespielt</TabBtn>
        <TabBtn active={tab === "playlists"} onClick={() => setTab("playlists")} icon={<ListMusic className="w-4 h-4" />}>Playlists</TabBtn>
        <TabBtn active={tab === "search"} onClick={() => setTab("search")} icon={<Search className="w-4 h-4" />}>Suche</TabBtn>
        <TabBtn active={tab === "devices"} onClick={() => setTab("devices")} icon={<Speaker className="w-4 h-4" />}>Geräte</TabBtn>
        <TabBtn
          active={tab === "wuensche"}
          onClick={() => setTab("wuensche")}
          icon={<Bell className="w-4 h-4" />}
          badge={openWishCount > 0 ? (openWishCount > 99 ? "99+" : String(openWishCount)) : null}
        >
          Wünsche
        </TabBtn>
      </div>

      {tab === "now" && (
        <div className="glass rounded-3xl p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Clock className="w-4 h-4" /> Zuletzt gespielt</h3>
          <TrackList
            loading={recent.isLoading}
            tracks={recent.data?.tracks ?? []}
            onPlay={(uri) => run(() => playFn({ data: { uri } }), "Spielt")}
            onQueue={(uri) => run(() => queueFn({ data: { uri } }), "Zur Warteschlange")}
          />
        </div>
      )}

      {tab === "playlists" && !activePlaylist && (
        <div className="space-y-6">
          <div className="glass rounded-3xl p-6">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><ListMusic className="w-4 h-4" /> Deine Playlists</h3>
            <PlaylistGrid
              loading={myPls.isLoading}
              playlists={myPls.data?.playlists ?? []}
              onOpen={(p) => setActivePlaylist(p)}
              onPlay={(uri) => run(() => playFn({ data: { uri } }), "Playlist gestartet")}
            />
          </div>
          <div className="glass rounded-3xl p-6">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Featured</h3>
            <PlaylistGrid
              loading={featured.isLoading}
              playlists={featured.data?.playlists ?? []}
              onOpen={(p) => setActivePlaylist(p)}
              onPlay={(uri) => run(() => playFn({ data: { uri } }), "Playlist gestartet")}
            />
          </div>
        </div>
      )}

      {tab === "playlists" && activePlaylist && (
        <div className="glass rounded-3xl p-6">
          <button onClick={() => setActivePlaylist(null)} className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Playlists
          </button>
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="text-lg font-semibold truncate">{activePlaylist.name}</h3>
            <button
              onClick={() => run(() => playFn({ data: { uri: activePlaylist.uri } }), "Playlist gestartet")}
              className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 text-sm font-semibold flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> Abspielen
            </button>
          </div>
          <TrackList
            loading={plTracks.isLoading}
            tracks={plTracks.data?.tracks ?? []}
            onPlay={(uri) => run(() => playFn({ data: { uri } }), "Spielt")}
            onQueue={(uri) => run(() => queueFn({ data: { uri } }), "Zur Warteschlange")}
          />
        </div>
      )}

      {tab === "search" && (
        <div className="glass rounded-3xl p-6 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Song, Künstler oder Playlist suchen…"
              className="w-full bg-white/5 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:bg-white/10"
            />
          </div>
          {query.trim().length > 1 && (
            <>
              {(search.data?.playlists?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Playlists</h4>
                  <PlaylistGrid
                    loading={false}
                    playlists={(search.data?.playlists ?? []).map((p: any) => ({ ...p, id: p.uri.split(":").pop(), tracks: 0 }))}
                    onOpen={(p) => setActivePlaylist(p)}
                    onPlay={(uri) => run(() => playFn({ data: { uri } }), "Playlist gestartet")}
                  />
                </div>
              )}
              <div>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Songs</h4>
                <TrackList
                  loading={search.isLoading}
                  tracks={search.data?.tracks ?? []}
                  onPlay={(uri) => run(() => playFn({ data: { uri } }), "Spielt")}
                  onQueue={(uri) => run(() => queueFn({ data: { uri } }), "Zur Warteschlange")}
                />
              </div>
            </>
          )}
        </div>
      )}

      {tab === "devices" && (
        <div className="glass rounded-3xl p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Speaker className="w-4 h-4" /> Wiedergabegeräte</h3>
          {(devices.data?.devices ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Kein Gerät verfügbar. Öffne Spotify auf einem Gerät oder aktiviere den PC-Lautsprecher.</p>
          )}
          <div className="space-y-2">
            {(devices.data?.devices ?? []).map((d: any) => (
              <button
                key={d.id}
                onClick={() => run(() => transferFn({ data: { deviceId: d.id } }), `Übertragen auf ${d.name}`)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition ${
                  d.is_active ? "bg-emerald-500/15 border border-emerald-500/30" : "bg-white/5 hover:bg-white/10"
                }`}
              >
                <Speaker className={`w-5 h-5 ${d.is_active ? "text-emerald-400" : "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.type}{d.is_active ? " · aktiv" : ""}</div>
                </div>
                <span className="text-xs text-muted-foreground">{d.volume_percent}%</span>
              </button>
            ))}
          </div>
          <Link to="/spotify-player" className="block mt-4 text-xs text-emerald-400 hover:text-emerald-300">
            → PC-Lautsprecher Einstellungen
          </Link>
        </div>
      )}

      {tab === "wuensche" && (
        <div className="glass rounded-3xl p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4" /> Song-Wünsche
          </h3>
          <SongRequestsPanel />
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: string | null;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
        active ? "bg-emerald-500 text-black" : "bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
      {badge && (
        <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

function TrackList({
  loading,
  tracks,
  onPlay,
  onQueue,
}: {
  loading: boolean;
  tracks: any[];
  onPlay: (uri: string) => void;
  onQueue: (uri: string) => void;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Lädt…</p>;
  if (tracks.length === 0) return <p className="text-sm text-muted-foreground">Keine Songs.</p>;
  return (
    <div className="space-y-1">
      {tracks.map((t, i) => (
        <div key={t.uri + i} className="group flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5">
          <div className="w-10 h-10 rounded-md bg-white/5 overflow-hidden flex-shrink-0">
            {t.image && <img src={t.image} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">{t.name}</div>
            <div className="text-xs text-muted-foreground truncate">{t.artists}</div>
          </div>
          <button
            onClick={() => onQueue(t.uri)}
            className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground"
            title="Zur Warteschlange"
          >
            <ListPlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPlay(t.uri)}
            className="p-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400"
            title="Abspielen"
          >
            <Play className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function PlaylistGrid({
  loading,
  playlists,
  onOpen,
  onPlay,
}: {
  loading: boolean;
  playlists: any[];
  onOpen: (p: { id: string; uri: string; name: string }) => void;
  onPlay: (uri: string) => void;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Lädt…</p>;
  if (playlists.length === 0) return <p className="text-sm text-muted-foreground">Keine Playlists.</p>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {playlists.map((p) => (
        <div key={p.uri} className="group relative rounded-xl bg-white/5 hover:bg-white/10 p-3 transition">
          <button onClick={() => onOpen({ id: p.id, uri: p.uri, name: p.name })} className="block w-full text-left">
            <div className="aspect-square rounded-lg bg-white/5 overflow-hidden mb-2 flex items-center justify-center">
              {p.image ? (
                <img src={p.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <ListMusic className="w-8 h-8 text-white/20" />
              )}
            </div>
            <div className="text-sm font-medium truncate">{p.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {p.owner}{p.tracks ? ` · ${p.tracks}` : ""}
            </div>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(p.uri);
            }}
            className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition p-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg"
            title="Abspielen"
          >
            <Play className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
