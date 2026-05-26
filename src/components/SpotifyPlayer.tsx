import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  Search,
  Speaker,
  X,
  Music2,
} from "lucide-react";
import {
  getNowPlaying,
  getSpotifyDevices,
  spotifyPlay,
  spotifyPause,
  spotifyNext,
  spotifyPrev,
  spotifyVolume,
  spotifySearch,
  spotifyTransfer,
} from "@/lib/spotify.functions";
import { toast } from "sonner";

export function SpotifyPlayer() {
  const [open, setOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [query, setQuery] = useState("");

  const qc = useQueryClient();
  const nowPlayingFn = useServerFn(getNowPlaying);
  const devicesFn = useServerFn(getSpotifyDevices);
  const searchFn = useServerFn(spotifySearch);
  const playFn = useServerFn(spotifyPlay);
  const pauseFn = useServerFn(spotifyPause);
  const nextFn = useServerFn(spotifyNext);
  const prevFn = useServerFn(spotifyPrev);
  const volFn = useServerFn(spotifyVolume);
  const transferFn = useServerFn(spotifyTransfer);

  const np = useQuery({
    queryKey: ["spotify-now"],
    queryFn: () => nowPlayingFn(),
    refetchInterval: open ? 3000 : 10000,
    retry: false,
  });

  const devices = useQuery({
    queryKey: ["spotify-devices"],
    queryFn: () => devicesFn(),
    enabled: showDevices,
  });

  const search = useQuery({
    queryKey: ["spotify-search", query],
    queryFn: () => searchFn({ data: { q: query } }),
    enabled: query.length > 1 && showSearch,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["spotify-now"] });

  const showCommandResult = (result: any) => {
    if (result?.ok === false && result.error) toast.error(result.error);
  };

  const runCommand = (fn: () => Promise<any>) => {
    fn()
      .then((result) => {
        showCommandResult(result);
        refresh();
      })
      .catch((e: any) => toast.error(e.message));
  };

  const m = (fn: () => Promise<any>) =>
    useMutation({ mutationFn: fn, onSuccess: refresh, onError: (e: any) => toast.error(e.message) });

  const playM = useMutation({
    mutationFn: (uri?: string) => playFn({ data: { uri } }),
    onSuccess: refresh,
    onError: (e: any) => toast.error(e.message),
  });

  const data = np.data as any;
  const notConnected = data?.notConnected;
  const track = data?.track;

  if (notConnected) {
    return (
      <a
        href="/settings/spotify"
        className="glass rounded-2xl px-3 py-2 text-xs flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <Music2 className="w-4 h-4" />
        Spotify verbinden
      </a>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="glass rounded-2xl px-3 py-2 text-xs flex items-center gap-2 w-full text-left hover:border-accent/30"
      >
        {track?.image ? (
          <img src={track.image} alt="" className="w-8 h-8 rounded-md object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center">
            <Music2 className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{track?.name ?? "Nichts läuft"}</div>
          <div className="truncate text-[10px] text-muted-foreground">{track?.artists ?? "Spotify"}</div>
        </div>
        {data?.playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass-strong rounded-3xl w-full max-w-md p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Music2 className="w-4 h-4 text-emerald-400" />
                Spotify
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              {track?.image ? (
                <img src={track.image} alt="" className="w-20 h-20 rounded-2xl object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Music2 className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{track?.name ?? "Nichts läuft"}</div>
                <div className="text-sm text-muted-foreground truncate">{track?.artists}</div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{track?.album}</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => runCommand(() => prevFn())}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              {data?.playing ? (
                <button
                  onClick={() => runCommand(() => pauseFn())}
                  className="p-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black"
                >
                  <Pause className="w-6 h-6" />
                </button>
              ) : (
                <button
                  onClick={() => playM.mutate(undefined)}
                  className="p-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black"
                >
                  <Play className="w-6 h-6" />
                </button>
              )}
              <button
                onClick={() => runCommand(() => nextFn())}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <input
                type="range"
                min={0}
                max={100}
                defaultValue={data?.volume ?? 50}
                onMouseUp={(e) => runCommand(() => volFn({ data: { volume: Number((e.target as HTMLInputElement).value) } }))}
                onTouchEnd={(e) => runCommand(() => volFn({ data: { volume: Number((e.target as HTMLInputElement).value) } }))}
                className="flex-1 accent-emerald-400"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowSearch((v) => !v); setShowDevices(false); }}
                className={`flex-1 rounded-xl py-2 text-xs flex items-center justify-center gap-2 ${
                  showSearch ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 hover:bg-white/10"
                }`}
              >
                <Search className="w-3.5 h-3.5" /> Suchen
              </button>
              <button
                onClick={() => { setShowDevices((v) => !v); setShowSearch(false); }}
                className={`flex-1 rounded-xl py-2 text-xs flex items-center justify-center gap-2 ${
                  showDevices ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 hover:bg-white/10"
                }`}
              >
                <Speaker className="w-3.5 h-3.5" />
                {data?.device?.name ?? "Gerät"}
              </button>
            </div>

            {showSearch && (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Song oder Playlist suchen…"
                  className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm outline-none focus:bg-white/10"
                />
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {search.data?.tracks.map((t: any) => (
                    <button
                      key={t.uri}
                      onClick={() => playM.mutate(t.uri)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 text-left"
                    >
                      {t.image && <img src={t.image} className="w-9 h-9 rounded" alt="" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">{t.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{t.artists}</div>
                      </div>
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  ))}
                  {search.data?.playlists.map((p: any) => (
                    <button
                      key={p.uri}
                      onClick={() => playM.mutate(p.uri)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 text-left"
                    >
                      {p.image && <img src={p.image} className="w-9 h-9 rounded" alt="" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">Playlist · {p.owner}</div>
                      </div>
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showDevices && (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {devices.data?.devices.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">
                    Keine Geräte gefunden. Öffne Spotify auf einem Gerät.
                  </p>
                )}
                {devices.data?.devices.map((d: any) => (
                  <button
                    key={d.id}
                    onClick={() => runCommand(() => transferFn({ data: { deviceId: d.id } }))}
                    className={`w-full flex items-center gap-2 p-2.5 rounded-lg text-left ${
                      d.is_active ? "bg-emerald-500/15 text-emerald-200" : "hover:bg-white/5"
                    }`}
                  >
                    <Speaker className="w-4 h-4" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{d.name}</div>
                      <div className="text-[10px] text-muted-foreground">{d.type}</div>
                    </div>
                    {d.is_active && <span className="text-[10px]">aktiv</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
