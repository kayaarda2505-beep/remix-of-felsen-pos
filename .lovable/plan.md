## Ziel
- Web-Build (`npm run build`) bleibt 1:1 wie heute (TanStack Start + Cloudflare SSR).
- Neuer Befehl `npm run build:electron` erzeugt ein reines statisches Bundle in `dist-electron/` mit `index.html`, das per `file://` läuft.
- Server-Funktionen (`createServerFn`) und `/api/public/*`-Routen werden im Electron-Build via globalem `fetch`-Interceptor auf die veröffentlichte Lovable-URL umgeleitet.

## Was wird hinzugefügt (keine bestehenden Dateien werden ersetzt)

1. **`electron.html`** im Projekt-Root
   - Minimaler SPA-Shell, `<div id="app">`, lädt `src/electron-entry.tsx`.

2. **`src/electron-entry.tsx`**
   - Liest `VITE_ELECTRON_API_BASE` (Default: gehostete Lovable-URL).
   - Installiert globalen `fetch`-Proxy: jede relative URL, die mit `/api/`, `/_serverFn/`, `/_server` beginnt, wird mit der Basis-URL präfixiert; Supabase-Calls (absolute URLs) bleiben unverändert.
   - Erstellt `createRouter` (ohne SSR), nutzt `HashHistory` (damit `file://` + Refresh funktioniert), mountet `<RouterProvider />` mit den bestehenden `QueryClientProvider` / `AuthProvider` / `AppShell`.
   - Re-implementiert minimal das, was `__root.tsx`'s `RootComponent` macht, **ohne** `shellComponent` (das ist SSR-only).

3. **`src/routes/__root.tsx`** — kleine, abwärtskompatible Änderung
   - `RootComponent`-Inhalt wird in eine eigene exportierte Komponente `RootApp` ausgelagert, damit Electron-Entry sie wiederverwenden kann. `Route`-Definition bleibt identisch (Web-Build unverändert).

4. **`vite.electron.config.ts`**
   - Reines Vite + `@vitejs/plugin-react` + `@tanstack/router-plugin` (file-based routing, **ohne** TanStack Start / Cloudflare Plugin).
   - `root: '.'`, `build.outDir: 'dist-electron'`, `build.rollupOptions.input: 'electron.html'`, `base: './'` (für `file://`).
   - Alias `@ → src` wie im Hauptconfig.

5. **`package.json`**
   - Neues Script: `"build:electron": "vite build --config vite.electron.config.ts"`.
   - Optional `"preview:electron": "vite preview --config vite.electron.config.ts"` zum Testen im Browser.

## Wichtige Einschränkungen die der User wissen muss
- Im Electron-Build muss das Gerät die Lovable-URL erreichen können (Online-Pflicht), sonst funktionieren Stripe-Checkout, AI-Rezepte, Spotify, QR-Bestellungen und Webhooks nicht.
- CORS: damit der Browser von `file://` aus serverFns aufrufen darf, müssen die TanStack-Start-Routen auf der gehosteten Seite CORS für `Origin: null` (file://) bzw. `*` zulassen. Falls Lovable Hosting das nicht standardmäßig erlaubt, muss ich entweder einen CORS-Middleware-Eintrag in `src/start.ts` ergänzen oder Electron mit `webSecurity: false` (nicht empfohlen) starten. Ich ergänze die CORS-Header in `src/start.ts` als Teil dieses Plans.
- TanStack-Router-File-Routing erzeugt `routeTree.gen.ts` – wird vom Vite-Router-Plugin in beiden Configs gleich genutzt, also keine Doppelpflege.
- Routen die ausschließlich Server-Routes sind (`src/routes/api/public/*`) erscheinen im SPA-Bundle als leere Routen – Electron ruft sie ohnehin per `fetch` gegen den Hosted-Server auf, nicht als Page-Route.

## Was NICHT angefasst wird
- `vite.config.ts`, `wrangler.jsonc`, `src/server.ts`, `src/start.ts` (außer optional CORS), `src/router.tsx`, alle Routes-Dateien außer `__root.tsx` (minimal-invasiv).
- Keine neuen Abhängigkeiten nötig (alles vorhanden: `vite`, `@vitejs/plugin-react`, `@tanstack/router-plugin`, `@tanstack/react-router`).
