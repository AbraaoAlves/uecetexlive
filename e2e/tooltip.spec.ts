import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * Radix tooltip rollout (tooltip_plan.md): keyboard focus on the migrated
 * controls must surface a tooltip — one check per surface (shell, editor
 * toolbar) is enough to catch a missing/broken TooltipProvider wiring.
 */
test("keyboard focus shows a tooltip on shell and editor-toolbar controls", async ({
  page,
}) => {
  await page.goto("/");
  await dismissWelcome(page);

  await page.getByTestId("compile-button").focus();
  await expect(page.getByRole("tooltip")).toBeVisible();

  await page.getByTestId("engine-full").focus();
  await expect(page.getByRole("tooltip")).toBeVisible();

  await page.getByTestId("toolbar-bold").focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
});
