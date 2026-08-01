import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * Meta da Fase 1 do assistente: nenhuma etapa rola verticalmente no monitor
 * mais comum entre os alunos (1366×768). O projeto do modelo já vem com todos
 * os campos preenchidos, incluindo a banca — é o pior caso de altura.
 */
test.use({ viewport: { width: 1366, height: 768 } });

const TOTAL_STEPS = 8;

test("nenhuma etapa do assistente rola em 1366x768", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  await page.getByTestId("rail-metadata").click();
  await expect(page.getByTestId("metadata-wizard")).toBeVisible();

  const body = page.getByTestId("metadata-wizard").locator(".overflow-y-auto");
  const rolling: string[] = [];

  for (let step = 1; step <= TOTAL_STEPS; step++) {
    await page.getByTestId(`wizard-step-${step}`).click();
    await expect(body).toBeVisible();
    const overflow = await body.evaluate((el) => el.scrollHeight - el.clientHeight);
    if (overflow > 1) rolling.push(`etapa ${step}: sobra ${overflow}px`);
  }

  expect(rolling).toEqual([]);
});
