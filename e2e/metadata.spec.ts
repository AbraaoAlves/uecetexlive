import { expect, test } from "@playwright/test";

/**
 * F2: first-run welcome → wizard → \titulo written surgically into
 * documento.tex; work type switch swaps the conditional course fields.
 */
test("welcome → wizard fills title; documento.tex updated; persists", async ({
  page,
}) => {
  await page.goto("/");
  // First boot on a cold preview server (seed + chunk download) can beat the
  // default 5 s expect timeout — clicks elsewhere auto-wait far longer.
  await expect(page.getByTestId("welcome-dialog")).toBeVisible({ timeout: 15_000 });
  // "Preencher dados" abre o guia em tela cheia (M3 Fase 2); estas specs são
  // do modal de edição rápida, que se abre pelo painel.
  await page.getByTestId("welcome-later").click();
  await page.getByTestId("rail-metadata").click();
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

  // The wizard is a modal (QA §A3) — close it before reaching the shell.
  await page.getByTestId("wizard-close").click();
  await expect(page.getByTestId("metadata-wizard")).not.toBeVisible();

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
  // "Preencher dados" abre o guia em tela cheia (M3 Fase 2); estas specs são
  // do modal de edição rápida, que se abre pelo painel.
  await page.getByTestId("welcome-later").click();
  await page.getByTestId("rail-metadata").click();
  await expect(page.getByTestId("metadata-wizard")).toBeVisible();

  // "tipo" is the 2nd step; ehuab defaults to "nao" so localdopolo starts hidden.
  await page.getByTestId("wizard-step-2").click();
  await expect(page.getByTestId("metadata-field-localdopolo")).not.toBeVisible();

  await page.getByTestId("metadata-field-ehuab").selectOption("sim");
  const polo = page.getByTestId("metadata-field-localdopolo");
  await expect(polo).toBeVisible();
  await polo.fill("Limoeiro do Norte -- Ceará");
  await polo.blur();

  await page.getByTestId("wizard-close").click();
  await expect(page.getByTestId("metadata-wizard")).not.toBeVisible();

  await page.getByTestId("advanced-toggle").check();
  await page.getByTestId("rail-file-documento.tex").click();
  await expect(page.getByTestId("source-editor-value")).toHaveValue(/\\ehuab\{sim\}/);
  await expect(page.getByTestId("source-editor-value")).toHaveValue(
    /\\localdopolo\{Limoeiro do Norte -- Ceará\}/,
  );

  // Reopen, turn UAB back off: the field disappears and its value is cleared
  // surgically in the source, without touching any sibling macro.
  await page.getByTestId("rail-metadata").click();
  await expect(page.getByTestId("metadata-wizard")).toBeVisible();
  await page.getByTestId("wizard-step-2").click();
  await page.getByTestId("metadata-field-ehuab").selectOption("nao");
  await expect(page.getByTestId("metadata-field-localdopolo")).not.toBeVisible();
  await page.getByTestId("wizard-close").click();

  await expect(page.getByTestId("source-editor-value")).toHaveValue(/\\ehuab\{nao\}/);
  await expect(page.getByTestId("source-editor-value")).toHaveValue(/\\localdopolo\{\}/);
});

test("banca slots respect the work-type cap (TCC: 3, dissertação: 4, tese: 5)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("welcome-dialog")).toBeVisible({ timeout: 15_000 });
  // "Preencher dados" abre o guia em tela cheia (M3 Fase 2); estas specs são
  // do modal de edição rápida, que se abre pelo painel.
  await page.getByTestId("welcome-later").click();
  await page.getByTestId("rail-metadata").click();
  await expect(page.getByTestId("metadata-wizard")).toBeVisible();

  await page.getByTestId("wizard-step-2").click();
  await page.getByTestId("metadata-option-tccgraduacao").check();
  await page.getByTestId("wizard-step-6").click();
  await expect(page.getByTestId("metadata-field-membrodabancaquatro")).toBeVisible();
  await expect(page.getByTestId("metadata-field-membrodabancacinco")).not.toBeVisible();
  await expect(page.getByTestId("metadata-field-membrodabancaseis")).not.toBeVisible();

  await page.getByTestId("wizard-step-2").click();
  await page.getByTestId("metadata-option-dissertacao").check();
  await page.getByTestId("wizard-step-6").click();
  await expect(page.getByTestId("metadata-field-membrodabancacinco")).toBeVisible();
  await expect(page.getByTestId("metadata-field-membrodabancaseis")).not.toBeVisible();

  await page.getByTestId("wizard-step-2").click();
  await page.getByTestId("metadata-option-tese").check();
  await page.getByTestId("wizard-step-6").click();
  await expect(page.getByTestId("metadata-field-membrodabancaseis")).toBeVisible();
});

test("resumo/abstract step writes surgically into their own files, not documento.tex", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("welcome-dialog")).toBeVisible({ timeout: 15_000 });
  // "Preencher dados" abre o guia em tela cheia (M3 Fase 2); estas specs são
  // do modal de edição rápida, que se abre pelo painel.
  await page.getByTestId("welcome-later").click();
  await page.getByTestId("rail-metadata").click();
  await expect(page.getByTestId("metadata-wizard")).toBeVisible();

  await page.getByTestId("wizard-step-7").click();
  const resumo = page.getByTestId("metadata-field-resumobody");
  await resumo.fill("Este trabalho investiga o uso de jogos digitais no ensino.");
  await resumo.blur();
  const palavrasChave = page.getByTestId("metadata-field-palavraschave");
  await palavrasChave.fill("jogos digitais; ensino; programação.");
  await palavrasChave.blur();

  await page.getByTestId("wizard-step-8").click();
  const abstract = page.getByTestId("metadata-field-abstractbody");
  await abstract.fill("This work investigates the use of digital games in teaching.");
  await abstract.blur();
  const keywords = page.getByTestId("metadata-field-keywords");
  await keywords.fill("digital games; teaching; programming.");
  await keywords.blur();

  await page.getByTestId("wizard-close").click();

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

test("welcome 'Depois' leaves a pending badge; rail entry reopens the wizard", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("welcome-later").click();
  await expect(page.getByTestId("metadata-pending-dot")).toBeVisible();

  await page.getByTestId("rail-metadata").click();
  await expect(page.getByTestId("metadata-wizard")).toBeVisible();

  // Escape dismisses the modal (fields commit on blur — nothing is lost).
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("metadata-wizard")).not.toBeVisible();
});
