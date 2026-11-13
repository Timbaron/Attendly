/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import fs from "fs";

// Custom plugin to ensure manifest.json and public assets are copied cleanly
function chromeExtensionPlugin(): import("vite").Plugin {
  return {
    name: "chrome-extension-manifest",
    generateBundle(this: any) {
      // Read manifest.json and emit it into dist root
      const manifestPath = resolve(__dirname, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        this.emitFile({
          type: "asset",
          fileName: "manifest.json",
          source: fs.readFileSync(manifestPath, "utf-8"),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), chromeExtensionPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        dashboard: resolve(__dirname, "dashboard.html"),
        "service-worker": resolve(__dirname, "src/background/service-worker.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "service-worker") {
            return "[name].js";
          }
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
