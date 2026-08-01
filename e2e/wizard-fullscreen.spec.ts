import { expect, type Page, test } from "@playwright/test";

/**
 * Item 6: no primeiro uso, o guia leva o aluno do título ao PDF sem que ele
 * precise abrir nenhum arquivo .tex — inclusive pelos elementos opcionais e
 * pela ficha catalográfica, que antes só existiam dentro do documento.tex.
 */

async function fill(page: Page, macro: string, value: string): Promise<void> {
  const field = page.getByTestId(`metadata-field-${macro}`);
  await field.fill(value);
  await field.blur();
}

test("primeiro uso: guia preenche, tira uma página e gera o PDF", async ({ page }) => {
  test.setTimeout(300_000);

  await page.goto("/");
  await expect(page.getByTestId("welcome-dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("welcome-fill").click();
  await expect(page.getByTestId("wizard-fs")).toBeVisible();

  await fill(page, "titulo", "Jogos Digitais no Ensino de Programação");
  await page.getByTestId("wizard-fs-step-tipo").click();
  await page.getByTestId("metadata-option-tccgraduacao").check();
  await page.getByTestId("wizard-fs-step-autor").click();
  await fill(page, "autor", "Maria da Silva");
  await page.getByTestId("wizard-fs-step-orientacao").click();
  await fill(page, "orientador", "Prof. Dr. João Souza");
  await page.getByTestId("wizard-fs-step-datalocal").click();
  await fill(page, "data", "2026");
  await fill(page, "local", "Fortaleza -- Ceará");
  await page.getByTestId("wizard-fs-step-resumo").click();
  await fill(page, "resumobody", "Este trabalho investiga o uso de jogos digitais.");
  await fill(page, "palavraschave", "jogos digitais; ensino; programação.");

  // Elementos opcionais: tira a dedicatória sem abrir o documento.
  await page.getByTestId("wizard-fs-step-opcionais").click();
  const dedicatoria = page.getByTestId("wizard-fs-toggle-imprimirdedicatoria");
  await expect(dedicatoria).toBeChecked();
  await dedicatoria.uncheck();
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

  // Revisão: nada obrigatório pendente.
  await page.getByTestId("wizard-fs-step-revisao").click();
  await expect(page.getByTestId("wizard-fs-ready")).toBeVisible();

  await page.getByTestId("wizard-fs-compile").click();
  await expect(page.getByTestId("wizard-fs")).not.toBeVisible();
  await expect(page.getByTestId("compile-button")).toHaveAttribute("data-status", "ok", {
    timeout: 280_000,
  });
  await expect(page.getByTestId("pdf-pane")).toHaveAttribute("data-pages", /^[1-9]\d*$/, {
    timeout: 60_000,
  });

  const text = await page.evaluate(() =>
    (
      window as unknown as { __uecetexPdf: { getText: () => Promise<string> } }
    ).__uecetexPdf.getText(),
  );
  expect(text).toContain("JOGOS DIGITAIS NO ENSINO DE PROGRAMAÇÃO");
  expect(text).not.toContain("já cuida do alinha");
});

test("guia reabre pelo menu com o que já foi preenchido", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("welcome-later").click();
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();

  await page.getByTestId("menu-button").click();
  await page.getByTestId("menu-open-guide").click();
  await expect(page.getByTestId("wizard-fs")).toBeVisible();

  // O modelo semeado traz exemplos nos campos obrigatórios: a revisão aponta
  // todos eles, e o clique leva ao passo do campo.
  await page.getByTestId("wizard-fs-step-revisao").click();
  const pending = page.getByTestId("wizard-fs-pending");
  await expect(pending).toBeVisible();
  const before = await pending.locator("li").count();
  await page.getByTestId("wizard-fs-pending-titulo").click();
  await expect(page.getByTestId("metadata-field-titulo")).toBeVisible();

  // Escape sai sem perder o que estava sendo digitado — os campos gravam no
  // blur, e o guia força esse blur antes de fechar.
  await page.getByTestId("metadata-field-titulo").fill("Meu Trabalho de Verdade");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("wizard-fs")).not.toBeVisible();
  await expect(page.getByTestId("work-title")).toHaveText("Meu Trabalho de Verdade");

  // E reabrindo, a pendência do título sumiu da lista.
  await page.getByTestId("menu-button").click();
  await page.getByTestId("menu-open-guide").click();
  await page.getByTestId("wizard-fs-step-revisao").click();
  await expect(page.getByTestId("wizard-fs-pending-titulo")).toHaveCount(0);
  await expect(pending.locator("li")).toHaveCount(before - 1);
});
