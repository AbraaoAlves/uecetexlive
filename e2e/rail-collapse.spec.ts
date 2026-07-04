import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * Collapsible rail (F3): toggle button + Mod+B shortcut, persisted collapse.
 */
test("rail collapses via toggle, reopens via Mod+B, persists collapsed", async ({
  page,
}) => {
  await page.goto("/");
  await dismissWelcome(page);
  const rail = page.getByTestId("project-rail");
  await expect(rail).toBeVisible();

  await page.getByTestId("rail-toggle").click();
  await expect(rail).not.toBeVisible();

  await page.keyboard.press("ControlOrMeta+b");
  await expect(rail).toBeVisible();

  await page.getByTestId("rail-toggle").click();
  await expect(rail).not.toBeVisible();

  await page.reload();
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("project-rail")).not.toBeVisible();
  // Reopen for sanity: content is intact after the collapsed boot.
  await page.getByTestId("rail-toggle").click();
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();
});
