import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "streaming",
  "app-remote-control",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-email",
  "user-read-private",
].join(" ");

function env() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Spotify Credentials fehlen.");
  return { id, secret };
}

async function getValidToken(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("spotify_auth")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Spotify nicht verbunden.");

  const expiresAt = new Date(data.expires_at).getTime();
  if (Date.now() < expiresAt - 30_000) return data.access_token;

  // refresh
  const { id, secret } = env();
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${id}:${secret}`),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: data.refresh_token,
    }),
  });
  if (!res.ok) throw new Error(`Spotify refresh fehlgeschlagen: ${await res.text()}`);
  const tok = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
  };
  const newExpires = new Date(Date.now() + tok.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from("spotify_auth")
    .update({
      access_token: tok.access_token,
      refresh_token: tok.refresh_token ?? data.refresh_token,
      expires_at: newExpires,
      scope: tok.scope ?? data.scope,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  return tok.access_token;
}

async function sp(path: string, init?: RequestInit) {
  const token = await getValidToken();
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 204) return null;
  const text = await res.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // Spotify hat kein JSON geliefert (z.B. HTML-Fehler-Seite, Plain-Text-Error)
      if (!res.ok) throw new Error(`Spotify ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }
  }
  if (!res.ok) throw new Error(json?.error?.message ?? `Spotify ${res.status}`);
  return json;
}

async function resolveSpotifyDeviceId(deviceId?: string) {
  if (deviceId) return deviceId;

  const data = await sp("/me/player/devices");
  const devices: any[] = data?.devices ?? [];
  const usableDevices = devices.filter((device) => device?.id && !device.is_restricted);
  const activeDevice = usableDevices.find((device) => device.is_active);

  return activeDevice?.id ?? usableDevices[0]?.id ?? null;
}

function noSpotifyDeviceMessage() {
  return "Kein Spotify-Gerät verfügbar. Öffne die PC-Lautsprecher-Seite oder Spotify auf einem Gerät.";
}

function isNoActiveDeviceError(error: unknown) {
  return String(error instanceof Error ? error.message : error).includes("No active device found");
}

function isVolumeControlDisallowedError(error: unknown) {
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  return msg.includes("cannot control device volume") || msg.includes("volume_control_disallow");
}

// ---------- Auth ----------

export const getSpotifyAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ redirectUri: z.string().url() }))
  .handler(async ({ data }) => {
    const { id } = env();
    const params = new URLSearchParams({
      client_id: id,
      response_type: "code",
      redirect_uri: data.redirectUri,
      scope: SCOPES,
      show_dialog: "true",
    });
    return { url: `https://accounts.spotify.com/authorize?${params}` };
  });

export const exchangeSpotifyCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ code: z.string().min(1), redirectUri: z.string().url() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, secret } = env();
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${id}:${secret}`),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: data.code,
        redirect_uri: data.redirectUri,
      }),
    });
    if (!res.ok) throw new Error(`Spotify token error: ${await res.text()}`);
    const tok = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
      token_type: string;
    };
    const expires_at = new Date(Date.now() + tok.expires_in * 1000).toISOString();
    await supabaseAdmin.from("spotify_auth").upsert({
      id: true,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at,
      scope: tok.scope,
      token_type: tok.token_type,
      updated_at: new Date().toISOString(),
    });
    return { ok: true };
  });

export const disconnectSpotify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("spotify_auth").delete().eq("id", true);
    return { ok: true };
  });

export const getSpotifyConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("spotify_auth")
      .select("updated_at")
      .eq("id", true)
      .maybeSingle();
    return { connected: !!data };
  });

// Liefert einen frischen Access-Token für den Browser (Web Playback SDK).
export const getSpotifyBrowserToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const token = await getValidToken();
    return { token };
  });

// ---------- Playback ----------

export const getNowPlaying = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const data = await sp("/me/player");
      if (!data) return { playing: false, track: null, device: null, volume: 50, progress_ms: 0 };
      return {
        playing: data.is_playing,
        progress_ms: data.progress_ms ?? 0,
        volume: data.device?.volume_percent ?? 50,
        device: data.device ? { id: data.device.id, name: data.device.name, type: data.device.type } : null,
        track: data.item
          ? {
              id: data.item.id,
              name: data.item.name,
              artists: data.item.artists?.map((a: any) => a.name).join(", ") ?? "",
              album: data.item.album?.name ?? "",
              image: data.item.album?.images?.[0]?.url ?? null,
              duration_ms: data.item.duration_ms,
              uri: data.item.uri,
            }
          : null,
      };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("nicht verbunden") || msg.includes("Credentials fehlen")) {
        return { notConnected: true } as any;
      }
      // Spotify hat geantwortet aber etwas ist schiefgegangen — UI nicht crashen lassen
      console.error("getNowPlaying error:", msg);
      return { playing: false, track: null, device: null, volume: 50, progress_ms: 0, error: msg };
    }
  });

export const getSpotifyDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const data = await sp("/me/player/devices");
    return { devices: data?.devices ?? [] };
  });

export const spotifyPlay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ uri: z.string().optional(), deviceId: z.string().optional() }))
  .handler(async ({ data }) => {
    const body = data.uri
      ? JSON.stringify(data.uri.startsWith("spotify:track:") ? { uris: [data.uri] } : { context_uri: data.uri })
      : undefined;

    const deviceId = await resolveSpotifyDeviceId(data.deviceId);
    if (!deviceId) throw new Error(noSpotifyDeviceMessage());

    // Transfer zum Gerät (falls nicht aktiv), dann play
    try {
      await sp("/me/player", {
        method: "PUT",
        body: JSON.stringify({ device_ids: [deviceId], play: false }),
      });
    } catch {
      // ignorieren, play übernimmt
    }

    await sp(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
      method: "PUT",
      body,
    });
    return { ok: true };
  });

export const spotifyPause = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const deviceId = await resolveSpotifyDeviceId();
    if (!deviceId) return { ok: false, error: noSpotifyDeviceMessage() };
    try {
      await sp(`/me/player/pause?device_id=${encodeURIComponent(deviceId)}`, { method: "PUT" });
    } catch (error) {
      if (isNoActiveDeviceError(error)) return { ok: false, error: noSpotifyDeviceMessage() };
      throw error;
    }
    return { ok: true };
  });

export const spotifyNext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const deviceId = await resolveSpotifyDeviceId();
    if (!deviceId) return { ok: false, error: noSpotifyDeviceMessage() };
    try {
      await sp(`/me/player/next?device_id=${encodeURIComponent(deviceId)}`, { method: "POST" });
    } catch (error) {
      if (isNoActiveDeviceError(error)) return { ok: false, error: noSpotifyDeviceMessage() };
      throw error;
    }
    return { ok: true };
  });

export const spotifyPrev = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const deviceId = await resolveSpotifyDeviceId();
    if (!deviceId) return { ok: false, error: noSpotifyDeviceMessage() };
    try {
      await sp(`/me/player/previous?device_id=${encodeURIComponent(deviceId)}`, { method: "POST" });
    } catch (error) {
      if (isNoActiveDeviceError(error)) return { ok: false, error: noSpotifyDeviceMessage() };
      throw error;
    }
    return { ok: true };
  });

export const spotifyVolume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ volume: z.number().min(0).max(100) }))
  .handler(async ({ data }) => {
    const deviceId = await resolveSpotifyDeviceId();
    if (!deviceId) return { ok: false, error: noSpotifyDeviceMessage() };
    const volume = Math.round(data.volume);
    try {
      await sp(`/me/player/volume?volume_percent=${volume}&device_id=${encodeURIComponent(deviceId)}`, { method: "PUT" });
    } catch (error) {
      if (isNoActiveDeviceError(error)) return { ok: false, error: noSpotifyDeviceMessage() };
      if (isVolumeControlDisallowedError(error)) {
        return { ok: false, error: "Dieses Gerät erlaubt keine Fernsteuerung der Lautstärke. Bitte direkt am Gerät regeln." };
      }
      throw error;
    }
    return { ok: true };
  });

export const spotifyTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ deviceId: z.string() }))
  .handler(async ({ data }) => {
    // Neu verbundene Web-Playback-Geräte brauchen manchmal ein paar Sekunden
    // bis sie in Spotify's Geräteliste auftauchen → kurz retryen.
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await sp("/me/player", {
          method: "PUT",
          body: JSON.stringify({ device_ids: [data.deviceId], play: true }),
        });
        return { ok: true };
      } catch (error: any) {
        lastError = error;
        const msg = String(error?.message ?? "");
        if (/Device not found/i.test(msg) || msg.includes("404")) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        throw error;
      }
    }
    return {
      ok: false,
      error:
        "Gerät noch nicht bei Spotify registriert. Bitte kurz warten und erneut versuchen.",
    };
  });

export const spotifySearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ q: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const r = await sp(`/search?type=track,playlist&limit=10&q=${encodeURIComponent(data.q)}`);
    return {
      tracks:
        r?.tracks?.items?.map((t: any) => ({
          uri: t.uri,
          name: t.name,
          artists: t.artists?.map((a: any) => a.name).join(", ") ?? "",
          image: t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url ?? null,
        })) ?? [],
      playlists:
        r?.playlists?.items?.filter(Boolean).map((p: any) => ({
          uri: p.uri,
          name: p.name,
          owner: p.owner?.display_name ?? "",
          image: p.images?.[0]?.url ?? null,
        })) ?? [],
    };
  });

// ---------- Library / Playlists ----------

export const getMyPlaylists = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const r = await sp(`/me/playlists?limit=50`);
      return {
        playlists:
          r?.items?.filter(Boolean).map((p: any) => ({
            uri: p.uri,
            id: p.id,
            name: p.name,
            owner: p.owner?.display_name ?? "",
            image: p.images?.[0]?.url ?? null,
            tracks: p.tracks?.total ?? 0,
          })) ?? [],
      };
    } catch (e: any) {
      return { playlists: [], error: String(e?.message ?? e) };
    }
  });

export const getFeaturedPlaylists = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const r = await sp(`/browse/featured-playlists?limit=20`);
      return {
        playlists:
          r?.playlists?.items?.filter(Boolean).map((p: any) => ({
            uri: p.uri,
            id: p.id,
            name: p.name,
            owner: p.owner?.display_name ?? "",
            image: p.images?.[0]?.url ?? null,
            tracks: p.tracks?.total ?? 0,
          })) ?? [],
      };
    } catch (e: any) {
      return { playlists: [], error: String(e?.message ?? e) };
    }
  });

export const getPlaylistTracks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ playlistId: z.string().min(1) }))
  .handler(async ({ data }) => {
    try {
      const r = await sp(`/playlists/${encodeURIComponent(data.playlistId)}/tracks?limit=100`);
      return {
        tracks:
          r?.items?.filter((i: any) => i?.track).map((i: any) => ({
            uri: i.track.uri,
            name: i.track.name,
            artists: i.track.artists?.map((a: any) => a.name).join(", ") ?? "",
            image: i.track.album?.images?.[2]?.url ?? i.track.album?.images?.[0]?.url ?? null,
            duration_ms: i.track.duration_ms,
          })) ?? [],
      };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      // Spotify hat im November 2024 viele Endpoints für neue Apps gesperrt
      // (Featured Playlists, Editorial Playlists wie "Top 50", etc.) → 403
      if (msg.includes("403") || msg.toLowerCase().includes("forbidden")) {
        return {
          tracks: [],
          error:
            "Diese Playlist kann nicht geladen werden (Spotify hat den Zugriff auf redaktionelle Playlists eingeschränkt). Bitte eine eigene Playlist wählen.",
        };
      }
      return { tracks: [], error: msg };
    }
  });

export const getRecentlyPlayed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const r = await sp(`/me/player/recently-played?limit=20`);
      const seen = new Set<string>();
      const tracks: any[] = [];
      for (const it of r?.items ?? []) {
        const t = it.track;
        if (!t || seen.has(t.uri)) continue;
        seen.add(t.uri);
        tracks.push({
          uri: t.uri,
          name: t.name,
          artists: t.artists?.map((a: any) => a.name).join(", ") ?? "",
          image: t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url ?? null,
        });
      }
      return { tracks };
    } catch (e: any) {
      return { tracks: [], error: String(e?.message ?? e) };
    }
  });

export const spotifyShuffle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ state: z.boolean() }))
  .handler(async ({ data }) => {
    const deviceId = await resolveSpotifyDeviceId();
    if (!deviceId) return { ok: false, error: noSpotifyDeviceMessage() };
    try {
      await sp(`/me/player/shuffle?state=${data.state}&device_id=${encodeURIComponent(deviceId)}`, { method: "PUT" });
    } catch (error) {
      if (isNoActiveDeviceError(error)) return { ok: false, error: noSpotifyDeviceMessage() };
      throw error;
    }
    return { ok: true };
  });

export const spotifyRepeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ state: z.enum(["off", "context", "track"]) }))
  .handler(async ({ data }) => {
    const deviceId = await resolveSpotifyDeviceId();
    if (!deviceId) return { ok: false, error: noSpotifyDeviceMessage() };
    try {
      await sp(`/me/player/repeat?state=${data.state}&device_id=${encodeURIComponent(deviceId)}`, { method: "PUT" });
    } catch (error) {
      if (isNoActiveDeviceError(error)) return { ok: false, error: noSpotifyDeviceMessage() };
      throw error;
    }
    return { ok: true };
  });

export const spotifyQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ uri: z.string().min(1) }))
  .handler(async ({ data }) => {
    const deviceId = await resolveSpotifyDeviceId();
    if (!deviceId) return { ok: false, error: noSpotifyDeviceMessage() };
    try {
      await sp(`/me/player/queue?uri=${encodeURIComponent(data.uri)}&device_id=${encodeURIComponent(deviceId)}`, { method: "POST" });
    } catch (error) {
      if (isNoActiveDeviceError(error)) return { ok: false, error: noSpotifyDeviceMessage() };
      throw error;
    }
    return { ok: true };
  });
