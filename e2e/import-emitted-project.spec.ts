import { expect, test } from "@playwright/test";
import { makeEmittedProjectZip } from "./fixtures/make-emitted-fixture";
import { dismissWelcome } from "./helpers";

/**
 * Regressão do projeto que chega de fora com a folha de aprovação de TCC e um
 * campo de assinatura em branco: antes do reparo, o motor Rascunho abortava com
 * "There's no line here to end" e não devolvia PDF nenhum.
 */
test("projeto importado com campo de assinatura vazio gera o PDF", async ({ page }) => {
  test.setTimeout(300_000);
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/");
  await dismissWelcome(page);
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();

  await page.getByTestId("menu-button").click();
  await page.getByTestId("menu-import-zip").click();
  await page.getByTestId("zip-input").setInputFiles({
    name: "emitido.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(makeEmittedProjectZip()),
  });
  await expect(page.getByTestId("import-dialog")).toBeVisible();
  await page.getByTestId("import-confirm").click();
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
