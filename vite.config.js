import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import react from "@vitejs/plugin-react";

import topLevelAwait from "vite-plugin-top-level-await";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: "esnext",
    sourcemap: "inline",
    rollupOptions: {
      output: {
        manualChunks: { tesseract: ['tesseract-wasm'], pdfjs: ['pdfjs-dist']}
      }
    }
  },
  css: {
    devSourcemap: true,
    sourcemap: true
  },
  plugins: [
    react(),
    topLevelAwait({
      // The export name of top-level await promise for each chunk module
      promiseExportName: "__tla",
      // The function to generate import names of top-level await promise in each chunk module
      promiseImportName: (i) => `__tla_${i}`
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "192px.png", "mask.svg"],
      workbox: {
        sourcemap: true,
        // index.js is > 5 MB
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024
      },
      devOptions: {
        enabled: false,
        type: "module"
      },
      start_url: "/?source=pwa",
      manifest: {
        name: "Bucketnotes",
        short_name: "Bucketnotes",
        description: "Distraction-free note-taking app",
        theme_color: "#f7f7f7",
        display: "standalone",
        icons: [
          {
            src: "192px.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "512px.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    })
  ]
});
