import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * QA Fase 3 (polimento): theme toggle activates the dark palette, persists,
 * and the equation editor shows a live KaTeX preview.
 */
test("theme toggle cycles, applies .dark and persists", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);

  const toggle = page.getByTestId("theme-toggle");
  await expect(toggle).toHaveAttribute("data-theme", "system");
  const html = page.locator("html");

  // system → light: .dark removed regardless of OS.
  await toggle.click();
  await expect(toggle).toHaveAttribute("data-theme", "light");
  await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);

  // light → dark: .dark applied.
  await toggle.click();
  await expect(toggle).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);

  // Persists across reload.
  await page.reload();
  await expect(page.getByTestId("theme-toggle")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
});

test("equation editor shows a live KaTeX preview", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  await page.getByTestId("rail-file-elementos-textuais/introducao.tex").click();
  const editor = page.getByTestId("wysiwyg-editor");
  await expect(editor).toBeVisible();

  // Insert an equation via the toolbar, then open its editor.
  await editor.click();
  await page.getByTestId("toolbar-equation").click();
  const mathBlock = page.getByTestId("math-block").first();
  await mathBlock.getByRole("button").first().click();

  const preview = page.getByTestId("math-live-preview");
  await expect(preview).toBeVisible();
  // KaTeX renders the TeX into the preview box.
  await expect(preview.locator(".katex")).toBeVisible();
});
