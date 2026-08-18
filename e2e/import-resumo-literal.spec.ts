import { expect, test } from "@playwright/test";
import {
  ABSTRACT_KEYWORDS,
  makeLiteralResumoZip,
  RESUMO_BODY,
  RESUMO_KEYWORDS,
} from "./fixtures/make-emitted-fixture";
import { dismissWelcome } from "./helpers";

/**
 * Item 4: um projeto cujo resumo traz "Palavras-chave:" como texto corrido
 * (a forma que sai do caminho PDF→LaTeX) chegava ao wizard com os campos
 * desabilitados. A normalização do import devolve a forma canônica.
 */
test("wizard carrega resumo e palavras-chave de um projeto importado", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/");
  await dismissWelcome(page);
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();

  await page.getByTestId("menu-button").click();
  await page.getByTestId("menu-import-zip").click();
  await page.getByTestId("zip-input").setInputFiles({
    name: "resumo-literal.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(makeLiteralResumoZip()),
  });
  await expect(page.getByTestId("import-dialog")).toBeVisible();
  await page.getByTestId("import-confirm").click();
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved", {
    timeout: 60_000,
  });

  await page.getByTestId("rail-guide").click();
  await expect(page.getByTestId("wizard-fs")).toBeVisible();
  await page.getByTestId("wizard-fs-step-resumo").click();

  const resumo = page.getByTestId("metadata-field-resumobody");
  await expect(resumo).toBeEnabled();
  await expect(resumo).toHaveValue(new RegExp(RESUMO_BODY.slice(0, 40)));
  await expect(resumo).not.toHaveValue(/Palavras-chave:/);

  await expect(page.getByTestId("metadata-field-palavraschave")).toHaveValue(
    RESUMO_KEYWORDS,
  );
  await page.getByTestId("wizard-fs-step-abstract").click();
  await expect(page.getByTestId("metadata-field-keywords")).toHaveValue(
    ABSTRACT_KEYWORDS,
  );
});
