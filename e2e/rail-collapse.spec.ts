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

test("rail is resizable with the keyboard and keeps the chosen width", async ({
  page,
}) => {
  await page.goto("/");
  await dismissWelcome(page);

  const rail = page.getByTestId("project-rail");
  const handle = page.getByTestId("rail-resize-handle");
  const before = await rail.evaluate((element) =>
    Math.round(element.getBoundingClientRect().width),
  );

  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(handle).toHaveAttribute("aria-valuenow", String(before + 16));
  await expect
    .poll(() =>
      rail.evaluate((element) => Math.round(element.getBoundingClientRect().width)),
    )
    .toBe(before + 16);

  await page.reload();
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("rail-resize-handle")).toHaveAttribute(
    "aria-valuenow",
    String(before + 16),
  );
});
