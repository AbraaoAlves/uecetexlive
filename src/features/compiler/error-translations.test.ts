import type { CompileDiagnostic } from "@papyru/compiler";
import { describe, expect, it, vi } from "vitest";
import { translateDiagnostic } from "./error-translations";

function diag(
  message: string,
  rawLogExcerpt = message,
  extra: Partial<CompileDiagnostic> = {},
): CompileDiagnostic {
  return { severity: "error", message, rawLogExcerpt, ...extra };
}

const noOpenFile = { bibPath: null, openFile: vi.fn() };

describe("translateDiagnostic", () => {
  it("names the offending command for Undefined control sequence", () => {
    const d = diag(
      "Undefined control sequence.",
      "! Undefined control sequence.\nl.23 \\unknowncmd\n              {x}",
    );
    expect(translateDiagnostic(d, noOpenFile).message).toContain("\\unknowncmd");
  });

  it("falls back to a generic message when no command can be recovered", () => {
    const d = diag("Undefined control sequence.", "! Undefined control sequence.");
    expect(translateDiagnostic(d, noOpenFile).message).toMatch(/comando desconhecido/i);
  });

  it("translates Missing $ inserted", () => {
    const d = diag("Missing $ inserted.");
    expect(translateDiagnostic(d, noOpenFile).message).toMatch(/cifrõe|matemática/i);
  });

  it("names the missing file", () => {
    const d = diag("File `figuras/foo.png' not found.");
    expect(translateDiagnostic(d, noOpenFile).message).toContain("figuras/foo.png");
  });

  it("names the undefined citation key and offers to open the .bib", () => {
    const openFile = vi.fn();
    const d = diag(
      "Citation `alves2010' on page 12 undefined on input line 8.",
      "LaTeX Warning: Citation `alves2010' on page 12 undefined on input line 8.",
      { severity: "warning" },
    );
    const result = translateDiagnostic(d, {
      bibPath: "elementos-pos-textuais/referencias.bib",
      openFile,
    });
    expect(result.message).toContain('"alves2010"');
    expect(result.action?.label).toBeTruthy();
    result.action?.onClick();
    expect(openFile).toHaveBeenCalledWith("elementos-pos-textuais/referencias.bib");
  });

  it("omits the action when no .bib was discovered", () => {
    const d = diag("Citation `alves2010' on page 12 undefined on input line 8.");
    expect(translateDiagnostic(d, noOpenFile).action).toBeUndefined();
  });

  it("translates Runaway argument", () => {
    const d = diag("Runaway argument?");
    expect(translateDiagnostic(d, noOpenFile).message).toMatch(/chave/i);
  });

  it("distinguishes an unclosed opening brace from a stray closing one", () => {
    const missingClose = diag("Missing } inserted.");
    expect(translateDiagnostic(missingClose, noOpenFile).message).toMatch(
      /fechar uma chave/i,
    );

    const missingOpen = diag("Missing { inserted.");
    expect(translateDiagnostic(missingOpen, noOpenFile).message).toMatch(
      /sobrou uma chave/i,
    );
  });

  it("falls back to a generic PT summary for anything unmapped", () => {
    const d = diag("Some future pdfTeX message nobody wrote a matcher for yet.");
    expect(translateDiagnostic(d, noOpenFile).message).toMatch(
      /não conseguimos traduzir/i,
    );
  });
});
