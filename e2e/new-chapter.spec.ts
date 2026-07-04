import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * QA Fase 1: "+" in the chapters header scaffolds the file, splices its
 * \input after the last chapter in documento.tex and opens it in WYSIWYG.
 */
test("new chapter button creates file + \\input and opens it", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept("Estudo de Caso"));
  await page.getByTestId("new-chapter").click();

  // The scaffolded chapter opens in the WYSIWYG editor with its title.
  const newFile = page.getByTestId("rail-file-elementos-textuais/estudo-de-caso.tex");
  await expect(newFile).toBeVisible();
  await expect(page.getByTestId("wysiwyg-editor").locator("h1")).toHaveText(
    "Estudo de Caso",
  );
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

  // documento.tex got the \input spliced right after conclusao.
  await page.getByTestId("advanced-toggle").check();
  await page.getByTestId("rail-file-documento.tex").click();
  await expect(page.getByTestId("source-editor")).toHaveValue(
    /\\input\{elementos-textuais\/conclusao\}\n\t\\input\{elementos-textuais\/estudo-de-caso\}/,
  );

  // Persists across reload; the include graph resolves the new chapter.
  await page.reload();
  await expect(
    page.getByTestId("rail-file-elementos-textuais/estudo-de-caso.tex"),
  ).toBeVisible();
});

test("empty prompt is a no-op", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept(""));
  await page.getByTestId("new-chapter").click();
  await expect(
    page.getByTestId("rail-file-elementos-textuais/novo-capitulo.tex"),
  ).not.toBeVisible();
});
