import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Gate G5 (§10.4): export zip → wipe IndexedDB → import zip → deep-equal VFS
 * → compile ok. Plus the Tier-4 .bbl import path.
 */
test("export → wipe → import round-trips the VFS and stays compilable", async ({
  page,
}) => {
  test.setTimeout(240_000);
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/");
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();

  // Snapshot the seeded VFS (path → byte length) from IndexedDB.
  const before = await page.evaluate(readVfs);
  expect(Object.keys(before).length).toBeGreaterThan(30);

  // Export the zip and capture its bytes via the download.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    (async () => {
      await page.getByTestId("menu-button").click();
      await page.getByTestId("menu-export-zip").click();
    })(),
  ]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const zipBytes = Buffer.concat(chunks);
  expect(zipBytes.length).toBeGreaterThan(1000);

  // Wipe IndexedDB and reload — a fresh seed occurs, but we then import.
  await page.evaluate(() => indexedDB.deleteDatabase("uecetexlive"));
  await page.reload();
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();

  // Import the captured zip via the hidden file input.
  await page.getByTestId("menu-button").click();
  await page.getByTestId("menu-import-zip").click();
  await page.getByTestId("zip-input").setInputFiles({
    name: "project.zip",
    mimeType: "application/zip",
    buffer: zipBytes,
  });
  await expect(page.getByTestId("import-dialog")).toBeVisible();
  await page.getByTestId("import-confirm").click();

  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
  const after = await page.evaluate(readVfs);
  expect(after).toEqual(before);

  // Still compilable (draft is fast).
  await page.getByTestId("compile-button").click();
  await expect(page.getByTestId("compile-button")).toHaveAttribute(
    "data-status",
    /ok|error/,
    { timeout: 200_000 },
  );
  expect(await page.getByTestId("compile-button").getAttribute("data-status")).toBe("ok");
});

test("import .bbl activates the Tier-4 precompiled bibliography path", async ({
  page,
}) => {
  test.setTimeout(900_000);
  page.on("dialog", (dialog) => dialog.accept());

  const bbl = readFileSync(join(__dirname, "fixtures/documento.bbl"));

  await page.goto("/");
  await expect(page.getByTestId("rail-section-chapters")).toBeVisible();

  await page.getByTestId("menu-button").click();
  await page.getByTestId("menu-import-bbl").click();
  await page.getByTestId("bbl-input").setInputFiles({
    name: "documento.bbl",
    mimeType: "application/x-bibtex",
    buffer: bbl,
  });
  await expect(page.getByTestId("import-dialog")).toBeVisible();
  await page.getByTestId("import-confirm").click();
  await page.getByTestId("menu-button").click();
  await expect(page.getByTestId("bbl-badge")).toBeVisible();
  await page.keyboard.press("Escape");

  // Full compile must NOT run bibtex8 (the orchestrator writes the .bbl).
  await page.getByTestId("engine-full").click();
  await page.getByTestId("compile-button").click();
  await expect(page.getByTestId("compile-button")).toHaveAttribute(
    "data-status",
    /ok|error/,
    { timeout: 840_000 },
  );
  expect(await page.getByTestId("compile-button").getAttribute("data-status")).toBe("ok");

  await page.getByTestId("preview-tab-log").click();
  const log = await page.getByTestId("raw-log").innerText();
  expect(log).toContain(".bbl importado");
  expect(log).not.toContain("$ bibtex8");

  // Bibliography still resolved in the PDF.
  await page.getByTestId("preview-tab-pdf").click();
  await expect(page.getByTestId("pdf-pane")).toHaveAttribute("data-pages", /^[1-9]\d*$/, {
    timeout: 60_000,
  });
  const text = await page.evaluate(() =>
    (
      window as unknown as { __uecetexPdf: { getText: () => Promise<string> } }
    ).__uecetexPdf.getText(),
  );
  expect(text).toContain("LAMPORT, L.");
});

/** Read the persisted VFS as { path: byteLength } from IndexedDB. */
function readVfs(): Promise<Record<string, number>> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("uecetexlive");
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("projects", "readonly");
      const get = tx.objectStore("projects").get("uecetex2");
      get.onsuccess = () => {
        const project = get.result as
          | { files: { path: string; bytes: Uint8Array }[] }
          | undefined;
        const out: Record<string, number> = {};
        for (const f of project?.files ?? []) out[f.path] = f.bytes.byteLength;
        resolve(out);
      };
      get.onerror = () => reject(get.error);
    };
    req.onerror = () => reject(req.error);
  });
}
