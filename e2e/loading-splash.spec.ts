import { expect, test } from "@playwright/test";

test("first paint never blanks: static splash ships in the raw HTML, then the shell replaces it", async ({
  page,
  request,
}) => {
  // The splash must be part of the document itself — not injected by JS —
  // so it paints before the app bundle finishes downloading (§1.1 UI_UX_PLAN).
  const raw = await (await request.get("/")).text();
  expect(raw).toContain('id="uecetex-splash"');
  expect(raw).toContain("Preparando seu editor");

  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#uecetex-splash")).toHaveCount(0);
});
