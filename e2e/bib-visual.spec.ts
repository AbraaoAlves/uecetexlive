import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * Item 1 do ciclo: todo arquivo .bib tem modo de visualização "Referências" na
 * área de edição, no mesmo botão em que os .tex alternam fonte/visual.
 */
test("referencias.bib abre na edição visual e o botão alterna para a fonte", async ({
  page,
}) => {
  await page.goto("/");
  await dismissWelcome(page);

  await page.getByTestId("rail-file-elementos-pos-textuais/referencias.bib").click();

  // O painel de referências ocupa a área de edição, não o painel lateral.
  const editorPane = page.getByTestId("editor-pane");
  await expect(editorPane.getByTestId("references-panel")).toBeVisible();
  await expect(page.getByTestId("view-toggle")).toHaveText("Fonte BibTeX");
  await expect(page.getByTestId("bib-summary")).toContainText("referências");

  await page.getByTestId("view-toggle").click();
  await expect(editorPane.getByTestId("source-editor")).toBeVisible();
  await expect(page.getByTestId("view-toggle")).toHaveText("Referências");

  await page.getByTestId("view-toggle").click();
  await expect(editorPane.getByTestId("references-panel")).toBeVisible();
});

test("o painel de referências cabe na área de edição, com o rail aberto ou não", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await dismissWelcome(page);
  await page.getByTestId("rail-file-elementos-pos-textuais/referencias.bib").click();

  const panel = page.getByTestId("references-panel");
  await expect(panel).toBeVisible();

  const fits = async () => panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);

  expect(await fits()).toBe(true);
  await page.getByTestId("rail-toggle").click();
  expect(await fits()).toBe(true);
});
