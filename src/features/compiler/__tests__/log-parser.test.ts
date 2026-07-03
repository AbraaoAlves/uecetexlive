import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLatexLog } from "../log-parser";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf-8");

describe("parseLatexLog", () => {
  it("clean log: no diagnostics, no rerun", () => {
    const parsed = parseLatexLog(fixture("clean.log"));
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.needsRerun).toBe(false);
    expect(parsed.citationsUndefined).toBe(false);
  });

  it("file-line-error mode: (file, line, message) triples", () => {
    const parsed = parseLatexLog(fixture("file-line-error.log"));
    const errors = parsed.diagnostics.filter((d) => d.severity === "error");
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatchObject({
      file: "elementos-textuais/introducao.tex",
      line: 42,
      message: "Undefined control sequence.",
    });
    expect(errors[0]?.rawLogExcerpt).toContain("\\badmacro");
    expect(errors[1]).toMatchObject({
      file: "elementos-textuais/introducao.tex",
      line: 57,
      message: "Missing $ inserted.",
    });
  });

  it("missing file: captured as error + missingFiles list", () => {
    const parsed = parseLatexLog(fixture("missing-file.log"));
    expect(parsed.missingFiles).toEqual(["glossaries.sty"]);
    const err = parsed.diagnostics.find((d) => d.message.includes("not found"));
    expect(err).toMatchObject({
      severity: "error",
      file: "lib/preambulo.tex",
      line: 56,
    });
  });

  it("rerun + undefined citations: warnings + flags", () => {
    const parsed = parseLatexLog(fixture("rerun.log"));
    expect(parsed.needsRerun).toBe(true);
    expect(parsed.citationsUndefined).toBe(true);
    const cite = parsed.diagnostics.find((d) => d.message.includes("alves2010"));
    expect(cite?.severity).toBe("warning");
  });

  it("draft-engine log without file-line-error: error found via l.N + paren stack", () => {
    const parsed = parseLatexLog(fixture("draft-engine.log"));
    const errors = parsed.diagnostics.filter((d) => d.severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Undefined control sequence.",
      line: 23,
    });
    // Paren stack: innermost open file at error time.
    expect(errors[0]?.file).toBe("ot1cmr.fd");
  });

  it("truncated log: never crashes, still extracts what it can", () => {
    const parsed = parseLatexLog(fixture("truncated.log"));
    const errors = parsed.diagnostics.filter((d) => d.severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      file: "elementos-textuais/metodologia.tex",
      line: 100,
    });
  });

  it("rerun-forever fixture keeps demanding a rerun", () => {
    expect(parseLatexLog(fixture("rerun-forever.log")).needsRerun).toBe(true);
  });

  it("empty input", () => {
    const parsed = parseLatexLog("");
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.needsRerun).toBe(false);
  });
});
