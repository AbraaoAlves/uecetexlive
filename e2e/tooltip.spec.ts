import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * Radix tooltips: keyboard focus on the migrated controls must surface a
 * tooltip — one check per surface (shell, editor toolbar) is enough to catch
 * a missing/broken TooltipProvider wiring.
 */
test("keyboard focus shows a tooltip on shell and editor-toolbar controls", async ({
  page,
}) => {
  await page.goto("/");
  await dismissWelcome(page);

  // Ao mudar o foco, o tooltip anterior ainda pode estar desmontando —
  // por isso a asserção olha o último montado, não "o único".
  for (const testId of ["compile-button", "engine-full", "toolbar-bold"]) {
    await page.getByTestId(testId).focus();
    await expect(page.getByRole("tooltip").last()).toBeVisible();
  }
});
