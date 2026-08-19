import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

test("a aba reflete lacunas reais e permanece selecionada ao abrir o guia", async ({
  page,
}) => {
  await page.goto("/");
  await dismissWelcome(page);

  await expect(page.getByTestId("checklist-pending-count")).toBeVisible();
  await page.getByTestId("rail-checklist").click();
  await expect(page.getByTestId("rail-tab-compliance")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByTestId("compliance-rail-panel")).toBeVisible();

  const pretextual = page.getByTestId("compliance-check-pretextual");
  await expect(pretextual).toHaveAttribute("data-status", "warn");
  await expect(page.getByTestId("compliance-check-figures")).toHaveAttribute(
    "data-status",
    "ok",
  );

  await page.getByTestId("compliance-goto-pretextual").click();
  await expect(page.getByTestId("wizard-fs")).toBeVisible();
  await expect(page.getByTestId("rail-tab-compliance")).toHaveAttribute(
    "aria-selected",
    "true",
  );

  const titulo = page.getByTestId("metadata-field-titulo");
  await titulo.fill("Jogos Digitais no Ensino de Programação");
  await titulo.blur();
  await page.getByTestId("wizard-fs-close").click();

  await expect(pretextual).toHaveAttribute("data-status", "warn");
  await expect(pretextual).not.toContainText("Faltam preencher 6 dados");
});

test("revisar uma referência não citada seleciona a entrada e abre seus detalhes", async ({
  page,
}) => {
  await page.goto("/");
  await dismissWelcome(page);

  await page.getByTestId("rail-checklist").click();
  const expand = page.getByTestId("compliance-expand-uncitedEntries");
  if ((await expand.getAttribute("aria-expanded")) === "false") await expand.click();
  const review = page.getByTestId("compliance-goto-uncitedEntries-uncitedEntries:knuth");
  await expect(
    page.getByTestId("compliance-item-uncitedEntries-uncitedEntries:knuth"),
  ).toContainText("The texbook");
  await expect(review).toHaveText("revisar referência");
  await review.click();

  await expect(page.getByTestId("rail-tab-compliance")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByTestId("editor-pane").getByTestId("references-panel"),
  ).toBeVisible();
  await expect(page.getByTestId("view-toggle")).toHaveText("Fonte BibTeX");
  await expect(page.getByTestId("reference-knuth")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(page.getByTestId("add-reference-dialog")).toBeVisible();
  await expect(page.getByTestId("reference-field-title")).toHaveValue("The texbook");
  await expect(page.getByTestId("reference-edit-remove")).toBeVisible();
});

test("corrigir o próximo percorre verificações sem repetir", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);

  await page.getByTestId("rail-checklist").click();
  const next = page.getByTestId("compliance-next-all");

  await next.click();
  await expect(page.getByTestId("wizard-fs")).toBeVisible();
  await page.getByTestId("wizard-fs-close").click();

  await next.click();
  await expect(page.getByTestId("wizard-fs")).toBeVisible();
  await page.getByTestId("wizard-fs-close").click();

  await next.click();
  await expect(
    page.getByTestId("editor-pane").getByTestId("references-panel"),
  ).toBeVisible();
  await expect(page.getByTestId("rail-tab-compliance")).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("setas alternam as abas sem abrir uma janela", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);

  const filesTab = page.getByTestId("rail-tab-files");
  const complianceTab = page.getByTestId("rail-tab-compliance");
  await filesTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(complianceTab).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(filesTab).toHaveAttribute("aria-selected", "true");
});
