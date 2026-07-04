import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * QA Fase 2: the source view is CodeMirror — syntax highlighting, line
 * numbers, and a pt-BR find/replace panel that actually rewrites the source.
 */
test("source view has CodeMirror with line numbers and a find panel", async ({
  page,
}) => {
  await page.goto("/");
  await dismissWelcome(page);
  await page.getByTestId("advanced-toggle").check();
  await page.getByTestId("rail-file-documento.tex").click();
  await expect(page.getByTestId("source-editor")).toBeVisible();

  // CodeMirror renders (gutter with line numbers, stex tokens).
  await expect(page.locator(".cm-gutters")).toBeVisible();
  await expect(page.locator(".cm-lineNumbers")).toBeVisible();

  // The find panel opens (button) and is localized.
  await page.getByTestId("source-find").click();
  const panel = page.locator(".cm-search");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("substituir");
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
});

test("find & replace rewrites the source and flows to the store", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  await page.getByTestId("rail-file-elementos-textuais/introducao.tex").click();
  await page.getByTestId("view-toggle").click();
  await expect(page.getByTestId("source-editor")).toBeVisible();

  await page.getByTestId("source-find").click();
  const findField = page.locator(".cm-search input[main-field]");
  await findField.fill("Introdução");
  const replaceField = page.locator(".cm-search input[name='replace']");
  await replaceField.fill("Introducao XYZ");
  // "substituir tudo" button.
  await page.locator(".cm-search button[name='replaceAll']").click();

  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
  await expect(page.getByTestId("source-editor-value")).toHaveValue(/Introducao XYZ/);
});
