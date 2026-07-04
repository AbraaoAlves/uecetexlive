import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

/**
 * Gate G4 (§10.3): open introducao.tex in WYSIWYG, write a section with
 * heading + bold + list via input rules, insert a citation via the slash
 * menu, toggle to source and assert clean LaTeX, then full-compile and find
 * the new section title in the PDF text layer.
 */
test("wysiwyg roundtrip: type → clean LaTeX → compiled PDF", async ({ page }) => {
  test.setTimeout(900_000);
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/");
  await dismissWelcome(page);
  await page.getByTestId("rail-file-elementos-textuais/introducao.tex").click();

  const editor = page.getByTestId("wysiwyg-editor");
  await expect(editor).toBeVisible();
  // Parsed corpus content is on screen (chapter heading promoted to h1).
  await expect(editor.locator("h1")).toContainText("Introdução");

  // Move to the end and add fresh content via input rules (§4.5). Caret goes
  // through the exposed editor handle: click + Ctrl+End races ProseMirror's
  // focus/selection and has historically glued typed text mid-document.
  await page.evaluate(() => {
    (
      window as unknown as {
        __uecetexEditor: { commands: { focus: (pos: "end") => void } };
      }
    ).__uecetexEditor.commands.focus("end");
  });
  await page.keyboard.press("Enter");
  await page.keyboard.type("## Resultados Preliminares", { delay: 10 });
  await expect(
    editor.locator("h2", { hasText: "Resultados Preliminares" }),
  ).toBeVisible();
  await page.keyboard.press("Enter");

  await page.keyboard.type("Um resultado **muito bom** apareceu.", { delay: 10 });
  await expect(editor.locator("strong")).toContainText("muito bom");
  await page.keyboard.press("Enter");

  // Bullet list via the slash menu (deterministic; input-rule lists are
  // covered by the unit suite). Marks Bet B2's list serialization.
  await page.keyboard.type("/lista", { delay: 30 });
  await expect(page.getByTestId("slash-menu")).toBeVisible();
  await page.getByTestId("slash-item-lista").click();
  await expect(editor.locator("ul li")).toBeVisible();
  await page.keyboard.type("primeiro item", { delay: 10 });
  await expect(editor.locator("ul li")).toContainText("primeiro item");
  await page.keyboard.press("Enter");
  await page.keyboard.type("segundo item", { delay: 10 });
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter"); // leave the list

  // Citation via slash menu (§4.5).
  await page.keyboard.type("Conforme ", { delay: 10 });
  await page.keyboard.type("/citacao", { delay: 30 });
  await expect(page.getByTestId("slash-menu")).toBeVisible();
  await page.getByTestId("slash-item-citacao").click();
  await expect(page.getByTestId("picker-citation")).toBeVisible();
  await page.getByTestId("picker-search").fill("lamport");
  await page.getByTestId("pick-cite-lamport1986latex").click();
  await expect(editor.getByTestId("citation-chip")).toBeVisible();

  // Autosave settles.
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");

  // Toggle to source (§4.6) and assert clean LaTeX.
  await page.getByTestId("view-toggle").click();
  const source = page.getByTestId("source-editor");
  await expect(source).toBeVisible();
  const latex = await source.inputValue();
  expect(latex).toContain("\\section{Resultados Preliminares}");
  expect(latex).toContain("\\textbf{muito bom}");
  expect(latex).toContain("\\begin{itemize}");
  expect(latex).toContain("\\item primeiro item");
  expect(latex).toContain("\\cite{lamport1986latex}");
  // Original content is untouched (identity for unedited blocks).
  expect(latex).toContain("\\chapter{Introdução}");
  expect(latex).toContain("\\begin{alineas}");

  // Full compile: the new section must reach the PDF text layer.
  await page.getByTestId("engine-full").click();
  await page.getByTestId("compile-button").click();
  await expect(page.getByTestId("compile-button")).toHaveAttribute(
    "data-status",
    /ok|error/,
    { timeout: 840_000 },
  );
  const status = await page.getByTestId("compile-button").getAttribute("data-status");
  if (status !== "ok") {
    await page.getByTestId("preview-tab-log").click();
    console.log(
      `[roundtrip log]\n${(await page.getByTestId("raw-log").innerText()).slice(-4000)}`,
    );
  }
  expect(status).toBe("ok");

  // Wait for pdf.js to finish loading the document (sets the text hook).
  await expect(page.getByTestId("pdf-pane")).toHaveAttribute("data-pages", /^[1-9]\d*$/, {
    timeout: 60_000,
  });

  const text = await page.evaluate(() =>
    (
      window as unknown as { __uecetexPdf: { getText: () => Promise<string> } }
    ).__uecetexPdf.getText(),
  );
  expect(text).toContain("Resultados Preliminares");
  expect(text).toContain("muito bom");
});
