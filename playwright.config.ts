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
const E2E_PORT = 41730;
const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

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
    baseURL: E2E_BASE_URL,
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
    // Keep direct invocations (`bunx playwright test ...`) self-contained.
    // Otherwise preview serves whichever ignored `dist/` happens to exist and
    // source/test changes can be exercised against an older service worker.
    command: `bun run build && bun run preview --host 127.0.0.1 --strictPort --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    // Keep the dedicated port exclusive too: concurrent suites should fail
    // clearly instead of testing the other run's build and service worker.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
