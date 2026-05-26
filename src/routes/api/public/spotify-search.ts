import { createFileRoute } from "@tanstack/react-router";

// Client-Credentials Token Cache (server-memory)
let cachedToken: { token: string; expires: number } | null = null;

async function getClientCredentialsToken() {
  if (cachedToken && Date.now() < cachedToken.expires - 30_000) return cachedToken.token;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Spotify nicht konfiguriert");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${id}:${secret}`),
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`Token fail: ${await res.text()}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: j.access_token, expires: Date.now() + j.expires_in * 1000 };
  return cachedToken.token;
}

export const Route = createFileRoute("/api/public/spotify-search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
        if (!q) return Response.json({ tracks: [] });
        try {
          const token = await getClientCredentialsToken();
          const r = await fetch(
            `https://api.spotify.com/v1/search?type=track&limit=8&q=${encodeURIComponent(q)}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (!r.ok) return Response.json({ tracks: [], error: `Spotify ${r.status}` }, { status: 200 });
          const j: any = await r.json();
          const tracks = (j?.tracks?.items ?? []).map((t: any) => ({
            id: t.id,
            name: t.name,
            artists: t.artists?.map((a: any) => a.name).join(", ") ?? "",
            image: t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url ?? null,
          }));
          return Response.json({ tracks });
        } catch (e: any) {
          return Response.json({ tracks: [], error: e?.message ?? "Fehler" }, { status: 200 });
        }
      },
    },
  },
});
