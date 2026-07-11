import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * 3.4 — "funciona no avião" (§11.3, src/sw.ts doc comment): once the SW has
 * activated and precached the app shell, a reload with zero network access
 * must still boot the editor and keep the student's project (IndexedDB,
 * not network-dependent either). This proves the app-shell half of the PWA
 * promise; it does not warm the ~150 MB engine payload (see sw-gzip.spec.ts
 * for that route) — writing/navigating works offline, compiling needs the
 * engine cache to already be warm from a prior visit.
 */
test("second visit boots and keeps the project with zero network access", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await dismissWelcome(page);
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, {
    timeout: 20_000,
  });

  // A small, network-independent proof that the project survives: rename the
  // work title, which persists to IndexedDB (not the network).
  await page.getByTestId("rail-metadata").click();
  const titulo = page.getByTestId("metadata-field-titulo");
  await titulo.fill("Título Offline");
  await titulo.blur();
  await page.getByTestId("wizard-close").click();
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByTestId("editor-pane")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("work-title")).toHaveText("Título Offline");

  await context.setOffline(false);
});
