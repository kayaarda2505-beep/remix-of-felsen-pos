import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { renameSync, existsSync, writeFileSync } from "fs";

// Stub server-only modules for Electron client-only build
const stubPath = resolve(__dirname, "src/electron-stub.ts");
writeFileSync(stubPath, `export const createServerFn = () => { const chain: any = { middleware: () => chain, inputValidator: () => chain, validator: () => chain, handler: (fn: any) => fn }; return chain; };
export default {};
export const createMiddleware = () => ({ server: () => ({ client: () => ({}) }) });
`);

export default defineConfig({
  base: "./",
  resolve: {
    alias: [
      { find: /^@tanstack\/react-start(\/.*)?$/, replacement: stubPath },
      { find: /^@tanstack\/start-server-core(\/.*)?$/, replacement: stubPath },
      { find: /^@\/integrations\/supabase\/auth-middleware$/, replacement: stubPath },
      { find: /^@\/integrations\/supabase\/auth-attacher$/, replacement: stubPath },
      { find: /^@\/integrations\/supabase\/client\.server$/, replacement: stubPath },
      { find: /^.*\.server$/, replacement: stubPath },
      { find: /^.*\.server\.(ts|tsx|js)$/, replacement: stubPath },
    ],
  },
  build: {
    outDir: "dist-electron",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "electron.html"),
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        warn(warning);
      },
    },
  },
  plugins: [
    react(),
    tsconfigPaths(),
    tailwindcss(),
    {
      name: "rename-electron-html",
      closeBundle() {
        const src = resolve(__dirname, "dist-electron/electron.html");
        const dest = resolve(__dirname, "dist-electron/index.html");
        if (existsSync(src)) renameSync(src, dest);
      },
    },
  ],
});
