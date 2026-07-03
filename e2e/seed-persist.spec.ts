import { expect, test } from "@playwright/test";

/**
 * Gate G1: boot → rail lists all §2 file groups; edit + reload persists.
 */
test("first boot seeds uecetex2 and the rail shows every section", async ({ page }) => {
  await page.goto("/");
  for (const section of [
    "root",
    "preTextual",
    "chapters",
    "postTextual",
    "library",
    "figures",
  ]) {
    await expect(page.getByTestId(`rail-section-${section}`)).toBeVisible();
  }
  // Chapter order mirrors documento.tex's \input sequence.
  const chapters = page.getByTestId("rail-section-chapters").locator("button");
  await expect(chapters.first()).toContainText("introducao.tex");
  await expect(chapters.nth(5)).toContainText("conclusao.tex");
});

test("source edit survives a reload (IndexedDB autosave)", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("rail-file-elementos-textuais/introducao.tex").click();
  const editor = page.getByTestId("source-editor");
  await expect(editor).toBeVisible();

  const marker = `% e2e-persist-${Date.now()}`;
  await editor.click();
  await editor.press("ControlOrMeta+End");
  await editor.pressSequentially(`\n${marker}`);

  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

  await page.reload();
  await page.getByTestId("rail-file-elementos-textuais/introducao.tex").click();
  await expect(page.getByTestId("source-editor")).toHaveValue(
    new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});
