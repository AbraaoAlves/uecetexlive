import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * 3.5: the reminder is derived from UiSettings.sessionCount/cumulativeEditMs
 * against a persisted baseline (see backup-reminder.ts) — priming
 * sessionCount directly in IndexedDB is the practical way to reach the
 * threshold without actually reloading the page N times.
 */
async function primeSessionCount(
  page: import("@playwright/test").Page,
  sessionCount: number,
) {
  await page.evaluate(async (count) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("uecetexlive");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction("settings", "readwrite");
    const existing = await new Promise<Record<string, unknown>>((resolve) => {
      const r = tx.objectStore("settings").get("ui");
      r.onsuccess = () => resolve((r.result as Record<string, unknown>) ?? {});
    });
    existing.sessionCount = count;
    tx.objectStore("settings").put(existing, "ui");
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });
  }, sessionCount);
}

test("backup reminder appears after N sessions and 'Depois' pushes it out again", async ({
  page,
}) => {
  await page.goto("/");
  await dismissWelcome(page);
  await expect(page.getByTestId("backup-reminder-banner")).not.toBeVisible();

  await primeSessionCount(page, 5);
  await page.reload();
  await expect(page.getByTestId("backup-reminder-banner")).toBeVisible();

  await page.getByTestId("backup-reminder-dismiss").click();
  await expect(page.getByTestId("backup-reminder-banner")).not.toBeVisible();

  // Dismissing resets the baseline — a reload right after must not re-show it.
  await page.reload();
  await expect(page.getByTestId("backup-reminder-banner")).not.toBeVisible();
});

test("'Baixar backup' downloads a zip and dismisses the reminder", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  await primeSessionCount(page, 5);
  await page.reload();
  await expect(page.getByTestId("backup-reminder-banner")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("backup-reminder-export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  await expect(page.getByTestId("backup-reminder-banner")).not.toBeVisible();
});
