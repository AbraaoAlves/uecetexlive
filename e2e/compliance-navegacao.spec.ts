import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

const FIGURE_ITEM = "compliance-item-fix-elementos-textuais/fundamentacao-teorica.tex:0";

async function selectedText(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() => window.getSelection()?.toString() ?? "");
}

test("uma figura irregular leva à linha certa no modo fonte em todo clique", async ({
  page,
}) => {
  await page.goto("/");
  await dismissWelcome(page);

  await page
    .getByTestId("rail-file-elementos-textuais/fundamentacao-teorica.tex")
    .click();
  await page.getByTestId("view-toggle").click();
  await expect(page.getByTestId("source-editor")).toBeVisible();

  await page.getByTestId("source-find").click();
  await page.getByTestId("find-input").fill("\\Fonte{Elaborado pelo autor}");
  await expect(page.getByTestId("find-count")).toContainText(/\d+ de [1-9]\d*/);
  await page.getByTestId("find-replace-all").click();
  await page.getByTestId("find-close").click();
  await page.getByTestId("view-toggle").click();

  await page.getByTestId("rail-checklist").click();
  await expect(page.getByTestId(FIGURE_ITEM)).toBeVisible();
  await page.getByTestId(FIGURE_ITEM).click();

  const sourceInput = page.getByTestId("source-editor-input");
  await expect(page.getByTestId("source-editor")).toBeVisible();
  await expect(page.getByTestId("view-toggle")).toHaveText("Editor visual");
  await expect(sourceInput).toBeFocused();
  expect(await selectedText(page)).toContain("\\begin{figure}[ht!]");

  await sourceInput.press("ControlOrMeta+End");
  expect(await selectedText(page)).not.toContain("\\begin{figure}[ht!]");

  await page.getByTestId("rail-checklist").click();
  await page.getByTestId(FIGURE_ITEM).click();
  await expect(sourceInput).toBeFocused();
  expect(await selectedText(page)).toContain("\\begin{figure}[ht!]");
});
