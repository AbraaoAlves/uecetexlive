import { expect, test } from "@playwright/test";

test("built app boots and renders the shell", async ({ page }) => {
  await page.goto("/");
  // Cold preview server + template seed can exceed the 5 s expect default.
  await expect(page.getByTestId("app-shell")).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveTitle(/UeceTexLive/);
});
