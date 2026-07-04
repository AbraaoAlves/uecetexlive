/// <reference types="vitest/config" />

import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Project-page deploys (abraaoalves.github.io/uecetexlive) build with
// BASE_PATH=/uecetexlive/ (deploy.yml); dev/preview/e2e stay at "/".
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // The WASM/TeX payload is huge (>200 MB) and content-stable. We do NOT
      // precache it (precache is the app shell only); it is runtime
      // cache-first so the first Completa warmup fills the cache and the app
      // then works fully offline (§11.3 — "funciona no avião").
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        // The app shell is small; the WASM/TeX trees are handled at runtime.
        globIgnores: ["**/wasm/**", "**/templates/**"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // Storybook is deployed as a sibling static site under the SW's
        // scope (${base}storybook/) — without the denylist entry, offline
        // navigations to it would be hijacked into the app shell.
        navigateFallbackDenylist: [
          new RegExp(`^${base}wasm/`),
          new RegExp(`^${base}templates/`),
          new RegExp(`^${base}storybook/`),
        ],
        runtimeCaching: [
          {
            // Serialized into sw.js — must not close over `base`. Matching
            // the path segment covers both "/" and subpath deploys.
            urlPattern: /\/(wasm|templates)\//,
            handler: "CacheFirst",
            options: {
              cacheName: "uecetex-assets",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 6000 },
              rangeRequests: true,
            },
          },
        ],
      },
      manifest: {
        name: "UeceTexLive",
        short_name: "UeceTexLive",
        description: "Edite e compile sua monografia UECE (abnTeX2) no navegador.",
        lang: "pt-BR",
        theme_color: "#4b7a55",
        background_color: "#f7f7f2",
        display: "standalone",
        start_url: base,
        scope: base,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    target: "es2022",
    rolldownOptions: {
      output: {
        // Split the heavy libs so the app shell stays under budget (§11.5).
        advancedChunks: {
          groups: [
            { name: "pdfjs", test: /pdfjs-dist/ },
            { name: "katex", test: /katex/ },
            { name: "tiptap", test: /@tiptap|prosemirror/ },
            { name: "react-vendor", test: /react|@tanstack/ },
          ],
        },
      },
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: [
        "src/features/latex-mapping/**/*.ts",
        "src/features/project/**/*.ts",
        "src/features/compiler/orchestrator.ts",
        "src/features/compiler/log-parser.ts",
      ],
      // seed.ts is a fetch-only integration shim — exercised by the seed
      // e2e, not unit tests. §9's TDD zone is schema/include-graph/zip/vfs.
      exclude: ["**/__tests__/**", "**/fixtures/**", "src/features/project/seed.ts"],
    },
  },
});
