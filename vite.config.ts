/// <reference types="vitest/config" />

import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { computeVendorHash } from "./src/build/vendor-hash";

// Project-page deploys (abraaoalves.github.io/uecetexlive) build with
// BASE_PATH=/uecetexlive/ (deploy.yml); dev/preview/e2e stay at "/".
const base = process.env.BASE_PATH ?? "/";

// Fingerprint of the vendored WASM engines + template (src/build/vendor-hash.ts).
// Exposed as VITE_-prefixed so it flows through import.meta.env into BOTH the
// app bundle and the injectManifest service-worker bundle (src/sw.ts reads it
// the same way it already reads import.meta.env.BASE_URL) — must be set before
// defineConfig runs so Vite's env population picks it up.
process.env.VITE_VENDOR_HASH = computeVendorHash(
  fileURLToPath(new URL(".", import.meta.url)),
);

export default defineConfig({
  // O worker do caminho PDF→projeto é um módulo ES (importa o núcleo
  // dinamicamente, para o WASM do leitor só descer quando alguém importa um
  // PDF). O formato padrão do Vite para workers é `iife`, que não aceita
  // await no topo — é o que o leitor usa para carregar o próprio WASM.
  worker: { format: "es" },
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // The WASM/TeX payload is huge (>200 MB) and content-stable. We do NOT
      // precache it (precache is the app shell only); it is runtime
      // cache-first so the first warmup fills the cache and the app then
      // works fully offline (§11.3 — "funciona no avião"). The worker source
      // (src/sw.ts, D12) also decompresses the gzip sidecars that the deploy
      // publishes for hosts that can't compress large binaries.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        // Include every emitted webfont fallback so offline rendering keeps
        // the same metrics even in browsers that cannot use WOFF2.
        globPatterns: ["**/*.{js,css,html,svg,woff2,woff,ttf}"],
        // The app shell is small; the WASM/TeX trees are handled at runtime.
        globIgnores: ["**/wasm/**", "**/templates/**"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        name: "UeceTexLive",
        short_name: "UeceTexLive",
        description: "Edite sua monografia UECE (abnTeX2) e gere o PDF no navegador.",
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
