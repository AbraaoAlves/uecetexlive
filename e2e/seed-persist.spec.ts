import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * Gate G1: boot → rail lists all §2 file groups; edit + reload persists.
 * Simple mode (default) hides structural sections; "Avançado" reveals them.
 */
test("first boot seeds uecetex2 and the rail shows every section", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  // Simple mode: prose sections only.
  for (const section of ["preTextual", "chapters", "postTextual", "figures"]) {
    await expect(page.getByTestId(`rail-section-${section}`)).toBeVisible();
  }
  await expect(page.getByTestId("rail-section-root")).not.toBeVisible();
  await expect(page.getByTestId("rail-section-library")).not.toBeVisible();

  // Advanced mode: structural sections appear.
  await page.getByTestId("advanced-toggle").check();
  for (const section of ["root", "library"]) {
    await expect(page.getByTestId(`rail-section-${section}`)).toBeVisible();
  }
  // Chapter order mirrors documento.tex's \input sequence. Scope to the file
  // list — the section header now carries the "+" new-chapter button.
  const chapters = page.getByTestId("rail-section-chapters").locator("ul button");
  await expect(chapters.first()).toContainText("introducao.tex");
  await expect(chapters.nth(5)).toContainText("conclusao.tex");
});

test("source edit survives a reload (IndexedDB autosave)", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  await page.getByTestId("rail-file-elementos-textuais/introducao.tex").click();
  // introducao.tex opens in WYSIWYG (§4.1); toggle to the raw source view.
  await page.getByTestId("view-toggle").click();
  await expect(page.getByTestId("source-editor")).toBeVisible();
  const editor = page.getByTestId("source-editor-input");

  const marker = `% e2e-persist-${Date.now()}`;
  await editor.click();
  await editor.press("ControlOrMeta+End");
  await editor.pressSequentially(`\n${marker}`);

  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

  await page.reload();
  await page.getByTestId("rail-file-elementos-textuais/introducao.tex").click();
  await page.getByTestId("view-toggle").click();
  await expect(page.getByTestId("source-editor-value")).toHaveValue(
    new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});
