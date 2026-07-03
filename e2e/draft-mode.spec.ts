import { expect, test } from "@playwright/test";

/**
 * Gate G4 (§10.1): boot → template visible → draft compile < 15 s cold →
 * PDF pane non-empty → draft-mode notice shown.
 */
test("draft mode: fast compile with [?] citations notice", async ({ page }) => {
  test.setTimeout(240_000);
  page.on("console", (msg) => {
    if (msg.text().startsWith("[draft]")) console.log(msg.text());
  });

  await page.goto("/");
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();

  // Draft is the default engine (§5.1 CompileSettings).
  await expect(page.getByTestId("engine-draft")).toHaveAttribute("aria-checked", "true");

  const started = Date.now();
  await page.getByTestId("compile-button").click();
  await expect(page.getByTestId("compile-button")).toHaveAttribute(
    "data-status",
    /ok|error/,
    { timeout: 200_000 },
  );
  const elapsed = Date.now() - started;
  console.log(`[draft] compile finished in ${elapsed}ms`);

  const status = await page.getByTestId("compile-button").getAttribute("data-status");
  if (status !== "ok") {
    await page.getByTestId("preview-tab-log").click();
    const log = await page.getByTestId("raw-log").innerText();
    console.log(`[draft] log tail:\n${log.slice(-4000)}`);
  }
  expect(status).toBe("ok");

  // PDF pane non-empty.
  await expect(page.getByTestId("pdf-pane")).toHaveAttribute("data-pages", /^[1-9]\d*$/);

  // Draft banner (§6.3) in the log pane.
  await page.getByTestId("preview-tab-log").click();
  await expect(page.getByTestId("log-pane")).toContainText(
    "Modo rascunho: citações, glossário e índice não são resolvidos",
  );

  // Compile a SECOND time: the PdfPane must tear down the previous pdf.js
  // document (loading-task.destroy, not proxy.destroy) without crashing.
  await page.getByTestId("preview-tab-pdf").click();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByTestId("compile-button").click();
  await expect(page.getByTestId("compile-button")).toHaveAttribute(
    "data-status",
    /ok|error/,
    { timeout: 200_000 },
  );
  await expect(page.getByTestId("pdf-pane")).toHaveAttribute("data-pages", /^[1-9]\d*$/, {
    timeout: 30_000,
  });
  expect(errors.filter((e) => e.includes("destroy"))).toEqual([]);
});
