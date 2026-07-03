import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Gate G2 — THE challenge gate (§15): upstream documento.tex compiles fully
 * in-browser via busytex with bibliography (bibtex8), glossary + index
 * (makeindex), figures and listings, matched against the Docker reference
 * build (e2e/fixtures/reference.json).
 */

const reference = JSON.parse(
  readFileSync(join(__dirname, "fixtures/reference.json"), "utf-8"),
) as { pages: number; probes: { bibliography: string; glossaryTerm: string } };

test("full build: uecetex2 with citations + glossary + index resolved", async ({
  page,
}) => {
  test.setTimeout(900_000);
  page.on("dialog", (dialog) => dialog.accept());
  page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}`));
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.startsWith("[compile log tail]")) console.log(text);
  });

  await page.goto("/");
  await expect(page.getByTestId("compile-button")).toBeVisible();

  await page.getByTestId("engine-full").click();
  await expect(page.getByTestId("engine-full")).toHaveAttribute("aria-checked", "true");

  await page.getByTestId("compile-button").click();

  await expect(page.getByTestId("compile-button")).toHaveAttribute(
    "data-status",
    /ok|error/,
    { timeout: 840_000 },
  );

  // On failure, surface the log before asserting.
  const status = await page.getByTestId("compile-button").getAttribute("data-status");
  if (status !== "ok") {
    await page.getByTestId("preview-tab-log").click();
    const log = await page.getByTestId("raw-log").innerText();
    console.log(`[compile log tail]\n${log.slice(-8000)}`);
  }
  expect(status).toBe("ok");

  // Pass sequence proves bibtex8 + makeindex ran (assert via the log pane).
  await page.getByTestId("preview-tab-log").click();
  const log = await page.getByTestId("raw-log").innerText();
  const bibtexAt = log.indexOf("$ bibtex8");
  console.log(
    `[compile log tail] bibtex8 section:\n${log.slice(bibtexAt, bibtexAt + 3000)}`,
  );
  expect(log).toContain("bibtex8");
  expect(log).toContain("makeindex");
  await page.getByTestId("preview-tab-pdf").click();

  // Page count within ±2 of the Docker reference build (§10).
  const pane = page.getByTestId("pdf-pane");
  await expect(pane).toHaveAttribute("data-pages", /^[1-9]\d*$/);
  const pages = Number(await pane.getAttribute("data-pages"));
  expect(Math.abs(pages - reference.pages)).toBeLessThanOrEqual(2);

  // Text layer: resolved bibliography entry + glossary term.
  const text = await page.evaluate(() =>
    (
      window as unknown as {
        __uecetexPdf: { getText: () => Promise<string> };
      }
    ).__uecetexPdf.getText(),
  );
  expect(text).toContain(reference.probes.bibliography);
  expect(text).toContain(reference.probes.glossaryTerm);
});
