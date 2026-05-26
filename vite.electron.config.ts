import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { renameSync, existsSync, writeFileSync } from "fs";

// Stub server-only modules for Electron client-only build
const stubPath = resolve(__dirname, "src/electron-stub.ts");
writeFileSync(stubPath, `const proxy: any = new Proxy(function(){}, { get: () => proxy, apply: () => proxy, construct: () => proxy });
export default proxy;
export const createServerFn = proxy;
export const createMiddleware = proxy;
export const supabaseAdmin = proxy;
export const requireSupabaseAuth = proxy;
export const attachSupabaseAuth = proxy;
export const useServerFn = () => proxy;
export const serverOnly = proxy;
export const json = proxy;
export const getEvent = proxy;
export const getHeaders = proxy;
export const setHeaders = proxy;
export const getCookie = proxy;
export const setCookie = proxy;
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
