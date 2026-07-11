import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseBibFile, serializeBibFile } from "../domain/bib-file";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../fixtures");
const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith(".bib"));

describe("round-trip identity", () => {
  it.each(fixtures)("%s round-trips byte-identical", (name) => {
    const source = readFileSync(join(fixturesDir, name), "utf-8");
    const file = parseBibFile(source);
    expect(serializeBibFile(file)).toBe(source);
  });

  it("empty source round-trips", () => {
    expect(serializeBibFile(parseBibFile(""))).toBe("");
  });

  it("never throws on pathological input", () => {
    const inputs = [
      "@",
      "@article",
      "@article{",
      "@article{key,",
      "@article{key, title = {unterminated",
      '@article{key, title = "unterminated',
      "{}}}{{{",
      "%".repeat(1000),
      "@misc{}",
    ];
    for (const input of inputs) {
      expect(() => serializeBibFile(parseBibFile(input))).not.toThrow();
      expect(serializeBibFile(parseBibFile(input))).toBe(input);
    }
  });
});
