import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/content/content-script.ts"),
      name: "AttendlyContentScript",
      formats: ["iife"],
      fileName: () => "content-script.js",
    },
  },
});
