import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import react from "@vitejs/plugin-react";
import version from "vite-plugin-package-version";

import topLevelAwait from "vite-plugin-top-level-await";

let base = "/";
if (process.env.BUILD_BASE_PATH) {
  base = process.env.BUILD_BASE_PATH;
}

// Content-Security-Policy, injected as <meta> into the production build only
// (the dev server needs inline scripts for React Fast Refresh).
// - scripts only from the app itself: blocks injected inline scripts/handlers
// - connect/img/media allow any http(s) origin, because the S3 endpoint is
//   user-defined and notes may embed external images
// - styles from jsdelivr for the print layout (minimaxcss)
// Note: frame-ancestors can't be set via <meta>; send it as a header if the
// app shouldn't be embeddable.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' data: blob: https: http:",
  "connect-src 'self' https: http:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function contentSecurityPolicy() {
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "<head>",
        `<head>\n  <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`,
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base,
  build: {
    target: "esnext",
    sourcemap: "inline",
    cssMinify: false,
    minify: false,
  },
  css: {
    devSourcemap: true,
    sourcemap: true,
  },
  plugins: [
    contentSecurityPolicy(),
    react(),
    version(),
    topLevelAwait({
      // The export name of top-level await promise for each chunk module
      promiseExportName: "__tla",
      // The function to generate import names of top-level await promise in each chunk module
      promiseImportName: (i) => `__tla_${i}`,
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "192px.png", "mask.svg"],
      workbox: {
        sourcemap: true,
        // index.js is > 5 MB
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
        type: "module",
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
            type: "image/png",
          },
          {
            src: "512px.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});
