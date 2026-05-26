import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist-electron",
    emptyOutDir: true,
  },
  plugins: [react(), tsconfigPaths(), tailwindcss()],
});
