import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * Simple mode (F1): default rail shows only student prose; "Avançado"
 * reveals structural files and persists across reloads (IndexedDB).
 */
test("simple mode hides structural files; Avançado reveals and persists", async ({
  page,
}) => {
  await page.goto("/");
  await dismissWelcome(page);
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();
  await expect(page.getByTestId("rail-file-documento.tex")).not.toBeVisible();
  await expect(page.getByTestId("rail-file-lib/uecetex2.sty")).not.toBeVisible();
  await expect(page.getByTestId("rail-hidden-count")).toBeVisible();

  await page.getByTestId("advanced-toggle").check();
  await expect(page.getByTestId("rail-file-documento.tex")).toBeVisible();
  await expect(page.getByTestId("rail-file-lib/uecetex2.sty")).toBeVisible();
  await expect(page.getByTestId("rail-hidden-count")).not.toBeVisible();

  await page.reload();
  await expect(page.getByTestId("advanced-toggle")).toBeChecked();
  await expect(page.getByTestId("rail-file-documento.tex")).toBeVisible();
});

test("turning Avançado off while a hidden file is open falls back to prose", async ({
  page,
}) => {
  await page.goto("/");
  await dismissWelcome(page);
  await page.getByTestId("advanced-toggle").check();
  await page.getByTestId("rail-file-documento.tex").click();
  await expect(page.getByTestId("source-editor")).toBeVisible();

  await page.getByTestId("advanced-toggle").uncheck();
  await expect(page.getByTestId("rail-file-documento.tex")).not.toBeVisible();
  // Fallback landing: introducao.tex (WYSIWYG-capable → view toggle appears).
  await expect(page.getByTestId("view-toggle")).toBeVisible();
});
