import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * QA §A2: Find & Replace lives in the WYSIWYG surface too — toolbar button
 * and Ctrl+F open the shared panel; replacements flow through regular
 * ProseMirror transactions into the serialized source.
 */
test("WYSIWYG find & replace: counter, highlights, replace all", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  await expect(page.getByTestId("wysiwyg-editor")).toBeVisible();

  // Toolbar button opens the panel.
  await page.getByTestId("toolbar-find").click();
  await expect(page.getByTestId("find-panel")).toBeVisible();

  await page.getByTestId("find-input").fill("Lorem");
  await expect(page.getByTestId("find-count")).toContainText(/1 de \d+/);
  // Matches are decorated in the document.
  await expect(page.locator(".uecetex-search-match").first()).toBeVisible();

  // Navigation advances the active match.
  await page.getByTestId("find-next").click();
  await expect(page.getByTestId("find-count")).toContainText(/2 de \d+/);

  // Replace all rewrites the prose; the source view must carry it.
  await page.getByTestId("find-replace-input").fill("Ipsissimum");
  await page.getByTestId("find-replace-all").click();
  await expect(page.getByTestId("find-count")).toContainText("nenhuma ocorrência");
  await page.getByTestId("find-close").click();

  await page.getByTestId("view-toggle").click();
  await expect(page.getByTestId("source-editor-value")).toHaveValue(/Ipsissimum/);
});

test("Ctrl+F opens the panel from the editor", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  await expect(page.getByTestId("wysiwyg-editor")).toBeVisible();
  await page.getByTestId("wysiwyg-editor").click();

  await page.keyboard.press("ControlOrMeta+f");
  await expect(page.getByTestId("find-panel")).toBeVisible();

  // Escape in the panel closes it and returns to the editor.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("find-panel")).not.toBeVisible();
});
