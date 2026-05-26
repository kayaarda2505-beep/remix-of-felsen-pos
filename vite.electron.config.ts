import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { renameSync, existsSync } from "fs";

const STUB_ID = "\0electron-stub";
const STUB_CODE = `const handler = { get: (t, p) => p === '__esModule' ? true : proxy, apply: () => proxy, construct: () => proxy };
const proxy = new Proxy(function(){}, handler);
export default proxy;
export { proxy };
const names = ['createServerFn','createMiddleware','supabaseAdmin','requireSupabaseAuth','attachSupabaseAuth','useServerFn','serverOnly','json','buildFallbackRecipes','getEvent','getHeaders','setHeaders'];
export const createServerFn = proxy;
export const createMiddleware = proxy;
export const supabaseAdmin = proxy;
export const requireSupabaseAuth = proxy;
export const attachSupabaseAuth = proxy;
export const useServerFn = () => proxy;
export const serverOnly = proxy;
export const json = proxy;
export const buildFallbackRecipes = proxy;
export const verifyWebhook = proxy;
export const StripeEnv = proxy;
export const stripe = proxy;
export const resend = proxy;
export const createStripeClient = proxy;
export const getEvent = proxy;
export const getHeaders = proxy;
export const setHeaders = proxy;
`;

function stubPlugin() {
  const matchers: RegExp[] = [
    /@tanstack\/react-start(\/.*)?$/,
    /@tanstack\/start-server-core(\/.*)?$/,
    /\.server(\.(ts|tsx|js))?$/,
    /\/auth-middleware$/,
    /\/auth-attacher$/,
    /\/client\.server$/,
  ];
  return {
    name: "electron-stub",
    enforce: "pre" as const,
    resolveId(id: string) {
      if (matchers.some((re) => re.test(id))) return STUB_ID;
      return null;
    },
    load(id: string) {
      if (id === STUB_ID) return STUB_CODE;
      return null;
    },
  };
}

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist-electron",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "electron.html"),
    },
  },
  plugins: [
    stubPlugin(),
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
