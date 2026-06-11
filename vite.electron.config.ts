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
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Serverseitige Module durch Stubs ersetzen — Code wird im Bundle
      // referenziert (z. B. via auth-middleware in *.functions.ts), aber
      // im Browser nie ausgeführt, weil fetch alle Server-Calls umleitet.
      "@tanstack/react-start/server": path.resolve(
        __dirname,
        "src/electron-stub.ts",
      ),
      "@tanstack/start-server-core": path.resolve(
        __dirname,
        "src/electron-stub.ts",
      ),
      "@/integrations/supabase/auth-middleware": path.resolve(
        __dirname,
        "src/electron-stub.ts",
      ),
      "@/integrations/supabase/auth-attacher": path.resolve(
        __dirname,
        "src/electron-stub.ts",
      ),
      "@/integrations/supabase/client.server": path.resolve(
        __dirname,
        "src/electron-stub.ts",
      ),
    },
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
    // serverFn-Module greifen teils auf process.env zu — im Browser nicht da.
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
