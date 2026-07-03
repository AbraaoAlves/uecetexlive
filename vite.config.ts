/// <reference types="vitest/config" />

import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    target: "es2022",
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
