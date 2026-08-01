import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Item 5: o aluno tem só o PDF. O pipeline inteiro roda no navegador — o
 * arquivo não sai do computador dele — e o projeto aparece compilável.
 *
 * O fixture é o próprio modelo compilado, reduzido a dois capítulos: sem
 * nenhum byte de trabalho real.
 */
test("importar PDF monta um projeto que gera PDF", async ({ page }) => {
  test.setTimeout(300_000);
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/");
  await dismissWelcome(page);
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();

  await page.getByTestId("menu-button").click();
  await page.getByTestId("menu-import-pdf").click();
  await page.getByTestId("pdf-input").setInputFiles({
    name: "documento-teste.pdf",
    mimeType: "application/pdf",
    buffer: readFileSync(join(__dirname, "fixtures/documento-teste.pdf")),
  });

  // Relatório antes de criar: contagens do que foi reconhecido.
  const report = page.getByTestId("import-pdf-report");
  await expect(report).toBeVisible({ timeout: 120_000 });
  await expect(report).toContainText(/capítulos?/);

  await page.getByTestId("import-pdf-confirm").click();
  // O guia abre para revisar os dados; fecha-se para chegar ao editor.
  await expect(page.getByTestId("wizard-fs")).toBeVisible();
  await page.getByTestId("wizard-fs-close").click();
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved", {
    timeout: 60_000,
  });

  await page.getByTestId("compile-button").click();
  await expect(page.getByTestId("compile-button")).toHaveAttribute(
    "data-status",
    /ok|error/,
    { timeout: 280_000 },
  );
  expect(await page.getByTestId("compile-button").getAttribute("data-status")).toBe("ok");
});

test("recusa arquivo que não é PDF, sem acordar o motor", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);

  await page.getByTestId("menu-button").click();
  await page.getByTestId("menu-import-pdf").click();
  await page.getByTestId("pdf-input").setInputFiles({
    name: "curriculo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("<html>não é PDF nenhum</html>"),
  });

  await expect(page.getByTestId("import-pdf-error")).toBeVisible();
  await expect(page.getByTestId("import-pdf-error")).toContainText(/PDF/);
});

test("PDF de outra origem é recusado, com opção de insistir", async ({ page }) => {
  test.setTimeout(180_000);
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/");
  await dismissWelcome(page);

  await page.getByTestId("menu-button").click();
  await page.getByTestId("menu-import-pdf").click();
  await page.getByTestId("pdf-input").setInputFiles({
    name: "outro.pdf",
    mimeType: "application/pdf",
    buffer: readFileSync(join(__dirname, "fixtures/nao-uecetex.pdf")),
  });

  const warning = page.getByTestId("import-pdf-low-confidence");
  await expect(warning).toBeVisible({ timeout: 120_000 });
  await expect(warning).toContainText(/modelo da UECE/);
  await expect(page.getByTestId("import-pdf-force")).toBeVisible();
});
