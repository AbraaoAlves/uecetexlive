import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * QA Fase 1: fixed toolbar over the WYSIWYG surface, word count in the
 * editor bar, and image upload through the figure picker.
 */
test("toolbar formats, word count updates, pickers open", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  await expect(page.getByTestId("wysiwyg-editor")).toBeVisible();
  await expect(page.getByTestId("editor-toolbar")).toBeVisible();

  // Word count: introducao.tex prose plus the whole-work total.
  await expect(page.getByTestId("word-count")).toContainText(/\d+ palavras/);
  await expect(page.getByTestId("word-count")).toContainText(/no trabalho/);

  // Toggle bold at the caret — the button must reflect the active mark.
  await page.getByTestId("wysiwyg-editor").click();
  const bold = page.getByTestId("toolbar-bold");
  await expect(bold).toHaveAttribute("aria-pressed", "false");
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "false");

  // Block toggle: bullet list on the current paragraph.
  const bulletList = page.getByTestId("toolbar-bullet-list");
  await bulletList.click();
  await expect(bulletList).toHaveAttribute("aria-pressed", "true");
  await bulletList.click();
  await expect(bulletList).toHaveAttribute("aria-pressed", "false");

  // Insert pickers open from the toolbar (citation shows the bib entries).
  await page.getByTestId("toolbar-cite").click();
  await expect(page.getByTestId("picker-citation")).toBeVisible();
  await expect(page.getByTestId("pick-cite-lamport1986latex")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("picker-citation")).not.toBeVisible();

  // Scaffold inserts share the slash-menu definitions (tabela/equacao).
  await page.getByTestId("toolbar-equation").click();
  await expect(page.getByTestId("math-block")).toBeVisible();
  await page.getByTestId("toolbar-table").click();
  await expect(page.getByTestId("table-grid")).toBeVisible();
  await expect(page.getByTestId("table-cell-0-0")).toHaveValue("A");
});

test("image upload lands in figuras/ and inserts a figure", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  await expect(page.getByTestId("wysiwyg-editor")).toBeVisible();
  await page.getByTestId("wysiwyg-editor").click();

  await page.getByTestId("toolbar-figure").click();
  await expect(page.getByTestId("picker-figure")).toBeVisible();
  await page
    .getByTestId("picker-upload-input")
    .setInputFiles(join(__dirname, "fixtures/grafico-de-teste.png"));

  // The figure node renders with the uploaded image, and the file shows in
  // the rail (figures stay visible in simple mode).
  await expect(page.getByTestId("figure-node")).toBeVisible();
  await expect(page.getByTestId("rail-file-figuras/grafico-de-teste.png")).toBeVisible();

  // Serialization: the chapter now carries the \includegraphics.
  await page.getByTestId("view-toggle").click();
  await expect(page.getByTestId("source-editor-value")).toHaveValue(
    /\\includegraphics\[width=0\.8\\textwidth\]\{figuras\/grafico-de-teste\}/,
  );
  await expect(page.getByTestId("source-editor-value")).toHaveValue(
    /\\label\{fig:grafico-de-teste\}/,
  );

  // Upload persists: wait out the autosave debounce, then reload.
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
  await page.reload();
  await expect(page.getByTestId("rail-file-figuras/grafico-de-teste.png")).toBeVisible();
});
