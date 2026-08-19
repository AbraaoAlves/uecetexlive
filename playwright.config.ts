import { defineConfig, devices } from "@playwright/test";

/**
 * E2E suite runs against the *built* app (`vite preview`) — the same bits a
 * static host would serve. WASM compiles are slow on cold cache, hence the
 * generous timeouts on the full-build spec (set per-test, not globally).
 *
 * Tests that click engine-full trigger a real multi-pass pdftex compile in
 * the browser (minutes, not seconds) regardless of which file they live in —
 * matched by title, not filename, so a fast/slow pair in the same spec file
 * (see import-export.spec.ts) still splits across projects correctly.
 */
const FULL_COMPILE_TITLES =
  /full build: uecetex2 with citations|wysiwyg roundtrip: type|import \.bbl activates the Tier-4/;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "ui",
      grepInvert: FULL_COMPILE_TITLES,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "full-compile",
      grep: FULL_COMPILE_TITLES,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run preview --strictPort --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
