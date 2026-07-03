/**
 * bun scripts/pdf-metrics.ts <file.pdf> [--text]
 * Prints JSON {pages, textLength, sample} (+ full text with --text) using
 * pdfjs-dist. Used by reference-build.sh and e2e assertions.
 */
import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const [, , file, flag] = process.argv;
if (!file) {
  console.error("usage: bun scripts/pdf-metrics.ts <file.pdf> [--text]");
  process.exit(1);
}

const data = new Uint8Array(readFileSync(file));
const doc = await getDocument({ data, useSystemFonts: true }).promise;

let text = "";
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  text += `${content.items.map((item) => ("str" in item ? item.str : "")).join(" ")}\n`;
}

const out: Record<string, unknown> = {
  pages: doc.numPages,
  textLength: text.length,
};
if (flag === "--text") out.text = text;
console.log(JSON.stringify(out));
