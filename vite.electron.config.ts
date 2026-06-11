// Separater Build-Config für den statischen / Electron-Build.
// - Kein TanStack-Start, kein Cloudflare-Plugin → reines SPA-Bundle.
// - Output: dist-electron/index.html (entstanden aus electron.html).
// - `base: './'` damit Assets über `file://` geladen werden können.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig({
  base: "./",
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: path.resolve(__dirname, "src/routes"),
      generatedRouteTree: path.resolve(__dirname, "src/routeTree.gen.ts"),
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "src") },
      // Serverseitige Module durch Stubs ersetzen.
      {
        find: "@tanstack/react-start/server",
        replacement: path.resolve(__dirname, "src/electron-stub.ts"),
      },
      {
        find: "@tanstack/start-server-core",
        replacement: path.resolve(__dirname, "src/electron-stub.ts"),
      },
      {
        find: /^@tanstack\/start-server-core\/.*/,
        replacement: path.resolve(__dirname, "src/electron-stub.ts"),
      },
      {
        find: "@tanstack/start-storage-context",
        replacement: path.resolve(__dirname, "src/electron-stub.ts"),
      },
      {
        find: /^@tanstack\/start-storage-context\/.*/,
        replacement: path.resolve(__dirname, "src/electron-stub.ts"),
      },
      {
        find: "node:async_hooks",
        replacement: path.resolve(__dirname, "src/electron-stub.ts"),
      },
      {
        find: "@/integrations/supabase/auth-middleware",
        replacement: path.resolve(__dirname, "src/electron-stub.ts"),
      },
      {
        find: "@/integrations/supabase/auth-attacher",
        replacement: path.resolve(__dirname, "src/electron-stub.ts"),
      },
      {
        find: "@/integrations/supabase/client.server",
        replacement: path.resolve(__dirname, "src/electron-stub.ts"),
      },
    ],
  },
  build: {
    outDir: "dist-electron",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: path.resolve(__dirname, "electron.html"),
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  // Nach dem Build electron.html → index.html umbenennen, damit Electron
  // einfach win.loadFile('dist-electron/index.html') aufrufen kann.
  // (Vite/Rollup behält per Default den Input-Dateinamen bei.)
});
