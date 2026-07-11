import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * 3.4's actual gate for the 1.1 microcopy ("nas próximas visitas será
 * instantâneo"): the SW precaches the app shell (not the ~150 MB engine —
 * that's runtime cache-first, warmed separately by idle warmup), so a
 * *second* visit should reach an interactive editor well under 3s even on
 * a throttled connection, since every app-shell asset is served from the
 * Cache Storage the SW already owns rather than the (throttled) network.
 */
test("second visit reaches an interactive editor under 3s on throttled 3G", async ({
  page,
}) => {
  await page.goto("/");
  await dismissWelcome(page);
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, {
    timeout: 20_000,
  });

  const client = await page.context().newCDPSession(page);
  await client.send("Network.enable");
  // "Slow 3G"-ish DevTools preset: ~400 Kbps, 400 ms RTT.
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
    latency: 400,
  });

  const start = Date.now();
  await page.reload();
  await expect(page.getByTestId("editor-pane")).toBeVisible({ timeout: 5_000 });
  const elapsedMs = Date.now() - start;

  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0,
  });

  expect(elapsedMs, "second-visit time to interactive, throttled").toBeLessThan(3_000);
});
