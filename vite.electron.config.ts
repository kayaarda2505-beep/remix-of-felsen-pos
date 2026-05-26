import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { writeFileSync, readFileSync, renameSync, existsSync } from "fs";

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
    react(),
    tsconfigPaths(),
    tailwindcss(),
    {
      name: "rename-electron-html",
      closeBundle() {
        const src = resolve(__dirname, "dist-electron/electron.html");
        const dest = resolve(__dirname, "dist-electron/index.html");
        if (existsSync(src)) {
          renameSync(src, dest);
        }
      },
    },
  ],
});
