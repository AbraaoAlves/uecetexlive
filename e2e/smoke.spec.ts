import { expect, test } from "@playwright/test";

test("built app boots and renders the shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page).toHaveTitle(/UeceTexLive/);
});
