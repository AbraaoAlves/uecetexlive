import { expect, type Page, test } from "@playwright/test";
import { makeToggledOffZip } from "./fixtures/make-emitted-fixture";
import { dismissWelcome } from "./helpers";

function pdfText(page: Page): Promise<string> {
  return page.evaluate(() =>
    (
      window as unknown as { __uecetexPdf: { getText: () => Promise<string> } }
    ).__uecetexPdf.getText(),
  );
}

/**
 * Gera o PDF no motor Rascunho e espera o texto pedido aparecer (ou sumir).
 *
 * Duas esperas não bastariam sozinhas: `data-status` já vale "ok" da geração
 * anterior no instante do clique, e `data-pages` não muda quando a contagem de
 * páginas coincide — nos dois casos leríamos o PDF velho.
 */
async function compileAndExpectText(
  page: Page,
  term: string,
  present: boolean,
): Promise<void> {
  const button = page.getByTestId("compile-button");
  await button.click();
  await expect(button).not.toHaveAttribute("data-status", "ok", { timeout: 15_000 });
  await expect(button).toHaveAttribute("data-status", "ok", { timeout: 200_000 });
  await expect(page.getByTestId("pdf-pane")).toHaveAttribute("data-pages", /^[1-9]\d*$/, {
    timeout: 60_000,
  });
  const poll = expect.poll(() => pdfText(page), { timeout: 60_000 });
  if (present) await poll.toContain(term);
  else await poll.not.toContain(term);
}

/**
 * Item 1: o aluno tira e devolve uma página opcional pelo checkbox do painel,
 * sem nunca abrir documento.tex.
 */
test("checkbox tira e devolve os agradecimentos do PDF", async ({ page }) => {
  test.setTimeout(600_000);

  await page.goto("/");
  await dismissWelcome(page);
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();

  const checkbox = page.getByTestId("rail-toggle-imprimiragradecimentos");
  await expect(checkbox).toBeChecked();
  await compileAndExpectText(page, "AGRADECIMENTOS", true);

  await checkbox.uncheck();
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
  await expect(checkbox).not.toBeChecked();
  await compileAndExpectText(page, "AGRADECIMENTOS", false);

  await checkbox.check();
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
  await compileAndExpectText(page, "AGRADECIMENTOS", true);
});

/**
 * Estado único: o checkbox e o editor-fonte leem e escrevem a mesma linha.
 */
test("checkbox e editor-fonte compartilham o mesmo estado", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();

  const checkbox = page.getByTestId("rail-toggle-imprimiragradecimentos");
  await checkbox.uncheck();
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

  await page.getByTestId("advanced-toggle").check();
  await page.getByTestId("rail-file-documento.tex").click();
  await expect(page.getByTestId("source-editor-value")).toHaveValue(
    /%\\imprimiragradecimentos/,
  );

  // Descomentar à mão no editor devolve o checkbox ao estado marcado.
  await page.getByTestId("source-find").click();
  await page.getByTestId("find-input").fill("%\\imprimiragradecimentos");
  await page.getByTestId("find-replace-input").fill("\\imprimiragradecimentos");
  await page.getByTestId("find-replace-all").click();
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
  await expect(checkbox).toBeChecked();
});

/** Projeto que chega com a página já desligada abre com o checkbox limpo. */
test("projeto importado reflete o estado que veio no documento", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/");
  await dismissWelcome(page);
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();

  await page.getByTestId("menu-button").click();
  await page.getByTestId("menu-import-zip").click();
  await page.getByTestId("zip-input").setInputFiles({
    name: "sem-agradecimentos.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(makeToggledOffZip("imprimiragradecimentos")),
  });
  await expect(page.getByTestId("import-dialog")).toBeVisible();
  await page.getByTestId("import-confirm").click();
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved", {
    timeout: 60_000,
  });

  await expect(page.getByTestId("rail-toggle-imprimiragradecimentos")).not.toBeChecked();
  await expect(page.getByTestId("rail-toggle-imprimirdedicatoria")).toBeChecked();
});
