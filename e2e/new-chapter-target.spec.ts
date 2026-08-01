import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * M3 Fase 2: apêndices e anexos deixam de exigir a edição do documento.tex —
 * o mesmo diálogo do capítulo cria o arquivo, insere o \input no bloco certo
 * e liga a seção.
 */
test("cria um apêndice pelo diálogo, sem abrir o documento", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();

  await page.getByTestId("new-chapter").click();
  await page.getByTestId("new-chapter-title").fill("Questionário Aplicado");
  await page.getByTestId("new-chapter-target").selectOption("apendice");
  await page.getByTestId("new-chapter-create").click();
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

  const path = "elementos-pos-textuais/apendices/questionario-aplicado.tex";
  await expect(page.getByTestId(`rail-file-${path}`)).toBeVisible();

  await page.getByTestId("advanced-toggle").check();
  await page.getByTestId("rail-file-documento.tex").click();
  const source = page.getByTestId("source-editor-value");
  await expect(source).toHaveValue(
    /\\imprimirapendices[\s\S]*apendices\/questionario-aplicado/,
  );
  // O \input entrou antes do bloco de anexos.
  const text = await source.inputValue();
  expect(text.indexOf("questionario-aplicado")).toBeLessThan(
    text.indexOf("\\imprimiranexos"),
  );
});

test("cria um capítulo como antes", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();

  await page.getByTestId("new-chapter").click();
  await page.getByTestId("new-chapter-title").fill("Estudo de Caso");
  await page.getByTestId("new-chapter-create").click();
  await expect(
    page.getByTestId("rail-file-elementos-textuais/estudo-de-caso.tex"),
  ).toBeVisible();
});
