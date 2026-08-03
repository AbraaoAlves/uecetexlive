import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * 3.2: "Meu trabalho está certo?" checklist over the project's real state —
 * derived checks, not a separate source of truth (see compliance-checklist.ts).
 */
test("checklist reflects the fresh seed's real gaps and updates as they're fixed", async ({
  page,
}) => {
  await page.goto("/");
  await dismissWelcome(page);

  await expect(page.getByTestId("checklist-pending-count")).toBeVisible();
  await page.getByTestId("rail-checklist").click();
  await expect(page.getByTestId("compliance-checklist")).toBeVisible();

  // Fresh seed: title/author/advisor still template placeholders.
  await expect(page.getByTestId("compliance-check-pretextual")).toHaveAttribute(
    "data-status",
    "warn",
  );
  // The template's own worked-example figure has both \Caption and \Fonte.
  await expect(page.getByTestId("compliance-check-figures")).toHaveAttribute(
    "data-status",
    "ok",
  );

  // "corrigir" on pré-textuais closes the checklist and opens the wizard.
  await page.getByTestId("compliance-fix-pretextual").click();
  await expect(page.getByTestId("compliance-checklist")).not.toBeVisible();
  await expect(page.getByTestId("metadata-wizard")).toBeVisible();

  const titulo = page.getByTestId("metadata-field-titulo");
  await titulo.fill("Jogos Digitais no Ensino de Programação");
  await titulo.blur();
  await page.getByTestId("wizard-close").click();

  // Still warn — autor/orientador/data untouched — but the count should drop.
  await page.getByTestId("rail-checklist").click();
  const pretextual = page.getByTestId("compliance-check-pretextual");
  await expect(pretextual).toHaveAttribute("data-status", "warn");
  await expect(pretextual).not.toContainText("Faltam preencher 6 dados");
});

// ADR-08: as referências deixaram o painel lateral e viraram modo de
// visualização do .bib. Cada entrada irregular leva à edição visual, sem
// repetir no cabeçalho a mesma ação da primeira entrada.
test("'corrigir' em uma referência abre o .bib na edição visual", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);

  await page.getByTestId("rail-checklist").click();
  await page.locator('[data-testid^="compliance-item-fix-references:"]').first().click();
  await expect(page.getByTestId("compliance-checklist")).not.toBeVisible();

  const editorPane = page.getByTestId("editor-pane");
  await expect(editorPane.getByTestId("references-panel")).toBeVisible();
  await expect(page.getByTestId("view-toggle")).toHaveText("Fonte BibTeX");
});

test("Escape and the close button dismiss the checklist", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);

  await page.getByTestId("rail-checklist").click();
  await expect(page.getByTestId("compliance-checklist")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("compliance-checklist")).not.toBeVisible();

  await page.getByTestId("rail-checklist").click();
  await page.getByTestId("compliance-close").click();
  await expect(page.getByTestId("compliance-checklist")).not.toBeVisible();
});
