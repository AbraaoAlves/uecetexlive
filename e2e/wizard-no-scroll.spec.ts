import { expect, type Locator, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * Nenhuma etapa do guia rola verticalmente no monitor mais comum entre os
 * alunos (1366×768). O projeto do modelo já vem com todos os campos
 * preenchidos, incluindo a banca: é o pior caso de altura. A contagem sai dos
 * próprios botões de etapa, para não envelhecer quando um passo novo entrar.
 */
test.use({ viewport: { width: 1366, height: 768 } });

/** Sobra de rolagem de cada etapa, medida no container rolável. */
async function overflowPerStep(chips: Locator, body: Locator): Promise<string[]> {
  const total = await chips.count();
  expect(total).toBeGreaterThan(0);
  const rolling: string[] = [];
  for (let i = 0; i < total; i++) {
    await chips.nth(i).click();
    await expect(body).toBeVisible();
    const overflow = await body.evaluate((el) => el.scrollHeight - el.clientHeight);
    if (overflow > 1) rolling.push(`etapa ${i + 1}: sobra ${overflow}px`);
  }
  return rolling;
}

test("nenhuma etapa do guia aberto pelo painel rola em 1366x768", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  await page.getByTestId("rail-guide").click();
  await expect(page.getByTestId("wizard-fs")).toBeVisible();

  const wizard = page.getByTestId("wizard-fs");
  expect(
    await overflowPerStep(
      wizard.locator("[data-testid^='wizard-fs-step-']"),
      page.getByTestId("wizard-fs-body"),
    ),
  ).toEqual([]);
});
