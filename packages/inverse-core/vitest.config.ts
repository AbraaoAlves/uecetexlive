import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // O núcleo é JS puro — nenhum destes testes precisa de DOM.
    include: ["src/**/*.test.ts"],
  },
});
