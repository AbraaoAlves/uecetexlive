import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * QA Fase 2: UECEtab/tabular tables render as an editable grid in the WYSIWYG
 * surface; editing a cell rewrites only that cell and preserves the rules and
 * \Caption/\Fonte wrappers byte-for-byte.
 */
test("visual table: editing a cell rewrites only that cell", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  await page
    .getByTestId("rail-file-elementos-textuais/fundamentacao-teorica.tex")
    .click();
  await expect(page.getByTestId("wysiwyg-editor")).toBeVisible();

  // First UECEtab in the chapter is a {cll} table headed "Critério & …".
  const grid = page.getByTestId("table-grid").first();
  await expect(grid).toBeVisible();
  const cell = grid.getByTestId("table-cell-0-0");
  await expect(cell).toHaveValue("Critério");

  await cell.fill("Classe");
  await cell.press("Tab");
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

  // Source: the header cell changed; rules and wrappers survive.
  await page.getByTestId("view-toggle").click();
  const value = page.getByTestId("source-editor-value");
  await expect(value).toHaveValue(/Classe & Abordagem 1 & Abordagem 2/);
  await expect(value).toHaveValue(/\\toprule/);
  await expect(value).toHaveValue(/\\UECEtab\{\}\{/);
  await expect(value).not.toHaveValue(/Critério & Abordagem 1/);
});
