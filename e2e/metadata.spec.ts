import { expect, test } from "@playwright/test";

/**
 * F2: first-run welcome → wizard → \titulo written surgically into
 * documento.tex; work type switch swaps the conditional course fields.
 */
test("welcome → wizard fills title; documento.tex updated; persists", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("welcome-dialog")).toBeVisible();
  await page.getByTestId("welcome-fill").click();
  await expect(page.getByTestId("metadata-wizard")).toBeVisible();

  // Step 1: fill the title; commit on blur.
  const titulo = page.getByTestId("metadata-field-titulo");
  await titulo.fill("Jogos Digitais no Ensino de Programação");
  await titulo.blur();
  await expect(page.getByTestId("work-title")).toHaveText(
    "Jogos Digitais no Ensino de Programação",
  );
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

  // Step 2: choose TCC graduação — step 3 must swap mestrado → graduação.
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("metadata-option-tccgraduacao").check();
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("metadata-field-graduacaoem")).toBeVisible();
  await expect(page.getByTestId("metadata-field-programamestrado")).not.toBeVisible();

  // The write was surgical: documento.tex now carries the new \titulo.
  await page.getByTestId("advanced-toggle").check();
  await page.getByTestId("rail-file-documento.tex").click();
  await expect(page.getByTestId("source-editor")).toHaveValue(
    /\\titulo\{Jogos Digitais no Ensino de Programação\}/,
  );
  // Line-start match: the commented %\trabalhoacademico{...} variants must
  // stay untouched — only the active line swaps to tccgraduacao.
  await expect(page.getByTestId("source-editor")).toHaveValue(
    /\n\\trabalhoacademico\{tccgraduacao\}/,
  );
  await expect(page.getByTestId("source-editor")).not.toHaveValue(
    /\n\\trabalhoacademico\{dissertacao\}/,
  );

  // Persistence: title survives a reload; welcome does not reappear.
  await page.reload();
  await expect(page.getByTestId("work-title")).toHaveText(
    "Jogos Digitais no Ensino de Programação",
  );
  await expect(page.getByTestId("welcome-dialog")).not.toBeVisible();
});

test("welcome 'Depois' leaves a pending badge; rail entry reopens the wizard", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("welcome-later").click();
  await expect(page.getByTestId("metadata-pending-dot")).toBeVisible();

  await page.getByTestId("rail-metadata").click();
  await expect(page.getByTestId("metadata-wizard")).toBeVisible();

  // Selecting a file closes the wizard again.
  await page.getByTestId("rail-file-elementos-textuais/introducao.tex").click();
  await expect(page.getByTestId("metadata-wizard")).not.toBeVisible();
});
