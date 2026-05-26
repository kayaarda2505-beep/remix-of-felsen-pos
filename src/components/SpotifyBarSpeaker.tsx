import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getSpotifyBrowserToken,
  spotifyTransfer,
  getSpotifyConnection,
} from "@/lib/spotify.functions";

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

type Status = "idle" | "loading" | "ready" | "error";

type Ctx = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  status: Status;
  error: string | null;
  deviceId: string | null;
  isActive: boolean;
  connected: boolean | null;
  makeActive: () => Promise<void>;
};

const SpotifyBarSpeakerContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "saints-bar-speaker-enabled";

export function useBarSpeaker() {
  const ctx = useContext(SpotifyBarSpeakerContext);
  if (!ctx) throw new Error("useBarSpeaker must be used inside SpotifyBarSpeakerProvider");
  return ctx;
}

export function SpotifyBarSpeakerProvider({ children }: { children: ReactNode }) {
  const tokenFn = useServerFn(getSpotifyBrowserToken);
  const transferFn = useServerFn(spotifyTransfer);
  const connFn = useServerFn(getSpotifyConnection);

  const playerRef = useRef<any>(null);
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === "1";
  });
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

  const setEnabled = (v: boolean) => {
    setEnabledState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {}
  };

  useEffect(() => {
    connFn().then((c) => setConnected(c.connected)).catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    if (!enabled || connected !== true) {
      try {
        playerRef.current?.disconnect();
      } catch {}
      playerRef.current = null;
      setStatus("idle");
      setDeviceId(null);
      setIsActive(false);
      return;
    }
    if (playerRef.current) return;

    setStatus("loading");

    const start = () => {
      window.onSpotifyWebPlaybackSDKReady = async () => {
        try {
          const player = new window.Spotify.Player({
            name: "SAINTS POS – Bar Lautsprecher",
            getOAuthToken: async (cb: (t: string) => void) => {
              const { token } = await tokenFn();
              cb(token);
            },
            volume: 0.7,
          });

          player.addListener("ready", ({ device_id }: { device_id: string }) => {
            setDeviceId(device_id);
            setStatus("ready");
          });
          player.addListener("not_ready", () => {
            setStatus("error");
            setError("Gerät offline.");
          });
          player.addListener("initialization_error", ({ message }: any) => {
            setStatus("error");
            setError("Init: " + message);
          });
          player.addListener("authentication_error", ({ message }: any) => {
            setStatus("error");
            setError("Auth: " + message);
          });
          player.addListener("account_error", () => {
            setStatus("error");
            setError("Spotify Premium wird benötigt.");
          });
          player.addListener("player_state_changed", () => {
            player.getCurrentState().then((s: any) => setIsActive(!!s));
          });

          await player.connect();
          playerRef.current = player;
        } catch (e: any) {
          setStatus("error");
          setError(e.message);
        }
      };

      if (window.Spotify) {
        window.onSpotifyWebPlaybackSDKReady();
        return;
      }
      if (!document.querySelector('script[data-spotify-sdk]')) {
        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        script.setAttribute("data-spotify-sdk", "1");
        document.body.appendChild(script);
      }
    };

    start();
  }, [enabled, connected]);

  const makeActive = async () => {
    if (!deviceId) return;
    const res: any = await transferFn({ data: { deviceId } });
    if (res?.ok === false && res?.error) throw new Error(res.error);
    setIsActive(true);
  };

  return (
    <SpotifyBarSpeakerContext.Provider
      value={{ enabled, setEnabled, status, error, deviceId, isActive, connected, makeActive }}
    >
      {children}
    </SpotifyBarSpeakerContext.Provider>
  );
}
