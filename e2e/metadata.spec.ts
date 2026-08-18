import { expect, test } from "@playwright/test";

/**
 * Guia do trabalho: preenchimento → \titulo escrito cirurgicamente em
 * documento.tex; work type switch swaps the conditional course fields.
 */
test("welcome → guia preenche título; documento.tex atualizado; persiste", async ({
  page,
}) => {
  await page.goto("/");
  // First boot on a cold preview server (seed + chunk download) can beat the
  // default 5 s expect timeout — clicks elsewhere auto-wait far longer.
  await expect(page.getByTestId("welcome-dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("welcome-later").click();
  await page.getByTestId("rail-guide").click();
  await expect(page.getByTestId("wizard-fs")).toBeVisible();

  // Step 1: fill the title; commit on blur.
  const titulo = page.getByTestId("metadata-field-titulo");
  await titulo.fill("Jogos Digitais no Ensino de Programação");
  await titulo.blur();
  await expect(page.getByTestId("work-title")).toHaveText(
    "Jogos Digitais no Ensino de Programação",
  );
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

  // Step 2: choose TCC graduação — step 3 must swap mestrado → graduação.
  await page.getByTestId("wizard-fs-next").click();
  await page.getByTestId("metadata-option-tccgraduacao").check();
  await page.getByTestId("wizard-fs-next").click();
  await expect(page.getByTestId("metadata-field-graduacaoem")).toBeVisible();
  await expect(page.getByTestId("metadata-field-programamestrado")).not.toBeVisible();

  await page.getByTestId("wizard-fs-close").click();
  await expect(page.getByTestId("wizard-fs")).not.toBeVisible();

  // The write was surgical: documento.tex now carries the new \titulo.
  await page.getByTestId("advanced-toggle").check();
  await page.getByTestId("rail-file-documento.tex").click();
  await expect(page.getByTestId("source-editor-value")).toHaveValue(
    /\\titulo\{Jogos Digitais no Ensino de Programação\}/,
  );
  // Line-start match: the commented %\trabalhoacademico{...} variants must
  // stay untouched — only the active line swaps to tccgraduacao.
  await expect(page.getByTestId("source-editor-value")).toHaveValue(
    /\n\\trabalhoacademico\{tccgraduacao\}/,
  );
  await expect(page.getByTestId("source-editor-value")).not.toHaveValue(
    /\n\\trabalhoacademico\{dissertacao\}/,
  );

  // Persistence: title survives a reload; welcome does not reappear.
  await page.reload();
  await expect(page.getByTestId("work-title")).toHaveText(
    "Jogos Digitais no Ensino de Programação",
  );
  await expect(page.getByTestId("welcome-dialog")).not.toBeVisible();
});

test("UAB toggle reveals local do polo and clears it when turned off", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("welcome-dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("welcome-later").click();
  await page.getByTestId("rail-guide").click();
  await expect(page.getByTestId("wizard-fs")).toBeVisible();

  // "tipo" is the 2nd step; ehuab defaults to "nao" so localdopolo starts hidden.
  await page.getByTestId("wizard-fs-step-tipo").click();
  await expect(page.getByTestId("metadata-field-localdopolo")).not.toBeVisible();

  await page.getByTestId("metadata-field-ehuab").selectOption("sim");
  const polo = page.getByTestId("metadata-field-localdopolo");
  await expect(polo).toBeVisible();
  await polo.fill("Limoeiro do Norte -- Ceará");
  await polo.blur();

  await page.getByTestId("wizard-fs-close").click();
  await expect(page.getByTestId("wizard-fs")).not.toBeVisible();

  await page.getByTestId("advanced-toggle").check();
  await page.getByTestId("rail-file-documento.tex").click();
  await expect(page.getByTestId("source-editor-value")).toHaveValue(/\\ehuab\{sim\}/);
  await expect(page.getByTestId("source-editor-value")).toHaveValue(
    /\\localdopolo\{Limoeiro do Norte -- Ceará\}/,
  );

  // Reopen, turn UAB back off: the field disappears and its value is cleared
  // surgically in the source, without touching any sibling macro.
  await page.getByTestId("rail-guide").click();
  await expect(page.getByTestId("wizard-fs")).toBeVisible();
  await page.getByTestId("wizard-fs-step-tipo").click();
  await page.getByTestId("metadata-field-ehuab").selectOption("nao");
  await expect(page.getByTestId("metadata-field-localdopolo")).not.toBeVisible();
  await page.getByTestId("wizard-fs-close").click();

  await expect(page.getByTestId("source-editor-value")).toHaveValue(/\\ehuab\{nao\}/);
  await expect(page.getByTestId("source-editor-value")).toHaveValue(/\\localdopolo\{\}/);
});

test("banca slots respect the work-type cap (TCC: 3, dissertação: 4, tese: 5)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("welcome-dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("welcome-later").click();
  await page.getByTestId("rail-guide").click();
  await expect(page.getByTestId("wizard-fs")).toBeVisible();

  await page.getByTestId("wizard-fs-step-tipo").click();
  await page.getByTestId("metadata-option-tccgraduacao").check();
  await page.getByTestId("wizard-fs-step-banca").click();

  const segundo = page.getByTestId("metadata-field-membrodabancadois");
  const terceiro = page.getByTestId("metadata-field-membrodabancatres");
  const quarto = page.getByTestId("metadata-field-membrodabancaquatro");
  const quinto = page.getByTestId("metadata-field-membrodabancacinco");
  const sexto = page.getByTestId("metadata-field-membrodabancaseis");

  await expect(segundo).toBeVisible();
  await expect(terceiro).not.toBeVisible();
  await segundo.fill("Membro dois");
  await segundo.blur();
  await expect(terceiro).toBeVisible();
  await terceiro.fill("Membro três");
  await terceiro.blur();
  await expect(quarto).toBeVisible();
  await expect(quinto).not.toBeVisible();
  await expect(sexto).not.toBeVisible();

  await page.getByTestId("wizard-fs-step-tipo").click();
  await page.getByTestId("metadata-option-dissertacao").check();
  await page.getByTestId("wizard-fs-step-banca").click();
  await quarto.fill("Membro quatro");
  await quarto.blur();
  await expect(quinto).toBeVisible();
  await expect(sexto).not.toBeVisible();

  await page.getByTestId("wizard-fs-step-tipo").click();
  await page.getByTestId("metadata-option-tese").check();
  await page.getByTestId("wizard-fs-step-banca").click();
  await quinto.fill("Membro cinco");
  await quinto.blur();
  await expect(sexto).toBeVisible();
});

test("resumo/abstract step writes surgically into their own files, not documento.tex", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("welcome-dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("welcome-later").click();
  await page.getByTestId("rail-guide").click();
  await expect(page.getByTestId("wizard-fs")).toBeVisible();

  await page.getByTestId("wizard-fs-step-resumo").click();
  const resumo = page.getByTestId("metadata-field-resumobody");
  await resumo.fill("Este trabalho investiga o uso de jogos digitais no ensino.");
  await resumo.blur();
  const palavrasChave = page.getByTestId("metadata-field-palavraschave");
  await palavrasChave.fill("jogos digitais; ensino; programação.");
  await palavrasChave.blur();

  await page.getByTestId("wizard-fs-step-abstract").click();
  const abstract = page.getByTestId("metadata-field-abstractbody");
  await abstract.fill("This work investigates the use of digital games in teaching.");
  await abstract.blur();
  const keywords = page.getByTestId("metadata-field-keywords");
  await keywords.fill("digital games; teaching; programming.");
  await keywords.blur();

  await page.getByTestId("wizard-fs-close").click();

  await page.getByTestId("advanced-toggle").check();
  await page.getByTestId("rail-file-elementos-pre-textuais/resumo.tex").click();
  // resumo.tex is prose (WYSIWYG-eligible) — opens in the visual editor by default.
  await page.getByTestId("view-toggle").click();
  await expect(page.getByTestId("source-editor-value")).toHaveValue(
    /Este trabalho investiga o uso de jogos digitais no ensino\./,
  );
  await expect(page.getByTestId("source-editor-value")).toHaveValue(
    /\\palavraschave\{jogos digitais; ensino; programação\.\}/,
  );

  await page.getByTestId("rail-file-elementos-pre-textuais/abstract.tex").click();
  await expect(page.getByTestId("source-editor-value")).toHaveValue(
    /This work investigates the use of digital games in teaching\./,
  );
  await expect(page.getByTestId("source-editor-value")).toHaveValue(
    /\\keywords\{digital games; teaching; programming\.\}/,
  );

  // documento.tex itself is untouched by the resumo/abstract write.
  await page.getByTestId("rail-file-documento.tex").click();
  await expect(page.getByTestId("source-editor-value")).not.toHaveValue(
    /jogos digitais no ensino/,
  );
});

test("welcome 'Depois' leaves a pending badge; rail entry opens the guide", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("welcome-later").click();
  await expect(page.getByTestId("guide-pending-dot")).toBeVisible();

  await page.getByTestId("rail-guide").click();
  await expect(page.getByTestId("wizard-fs")).toBeVisible();

  // Escape fecha o guia (os campos gravam no blur — nada se perde).
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("wizard-fs")).not.toBeVisible();
});
