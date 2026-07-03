import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLatex } from "../parse";
import { serializeDoc } from "../serialize";

/**
 * Invariant #1 (§4.3): serializeDoc(parseLatex(s).doc) === s for EVERY .tex
 * file in the vendored uecetex2 corpus. Enforced in CI forever. Losslessness
 * is by construction: unrecognized regions ride as rawLatex slices.
 */
const fixturesDir = join(__dirname, "../fixtures");
const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith(".tex"));

describe("Invariant #1 — byte identity over the uecetex2 corpus", () => {
  it("has the whole corpus on disk", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(22);
  });

  it.each(fixtures)("%s round-trips byte-identical", (name) => {
    const source = readFileSync(join(fixturesDir, name), "utf-8");
    const { doc } = parseLatex(source);
    expect(serializeDoc(doc)).toBe(source);
  });

  it("empty source round-trips", () => {
    expect(serializeDoc(parseLatex("").doc)).toBe("");
  });

  it("never throws on pathological input", () => {
    const nasty = "\\begin{foo \n \\end{ % \\input{";
    expect(serializeDoc(parseLatex(nasty).doc)).toBe(nasty);
  });
});
