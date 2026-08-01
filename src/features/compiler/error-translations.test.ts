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

  it("aponta a folha de aprovação quando o erro vem dela", () => {
    // Trecho real do log do motor Rascunho com um centro da banca em branco.
    const d = diag(
      "There's no line here to end.",
      "! LaTeX Error: There's no line here to end.\n\nl.174 \t\\imprimirfolhadeaprovacao\n",
    );
    const { message } = translateDiagnostic(d, noOpenFile);
    expect(message).toMatch(/folha de aprovação/i);
    expect(message).toMatch(/banca/i);
  });

  it("dá a explicação geral do mesmo erro fora da folha de aprovação", () => {
    const d = diag(
      "There's no line here to end.",
      "! LaTeX Error: There's no line here to end.\n\nl.42 \\\\\n",
    );
    const { message } = translateDiagnostic(d, noOpenFile);
    expect(message).toMatch(/quebra de linha/i);
    expect(message).not.toMatch(/folha de aprovação/i);
  });

  it("translates Missing $ inserted", () => {
    const d = diag("Missing $ inserted.");
    expect(translateDiagnostic(d, noOpenFile).message).toMatch(/cifrõe|matemática/i);
  });

  it("names the missing file", () => {
    const d = diag("File `figuras/foo.png' not found.");
    expect(translateDiagnostic(d, noOpenFile).message).toContain("figuras/foo.png");
  });

  const citationDiag = () =>
    diag(
      "Citation `alves2010' on page 12 undefined on input line 8.",
      "LaTeX Warning: Citation `alves2010' on page 12 undefined on input line 8.",
      { severity: "warning" },
    );

  it("prefers 'Buscar e adicionar' (B4/B5) over opening the .bib when search is wired", () => {
    const onSearchCitation = vi.fn();
    const openFile = vi.fn();
    const result = translateDiagnostic(citationDiag(), {
      bibPath: "elementos-pos-textuais/referencias.bib",
      openFile,
      onSearchCitation,
    });
    expect(result.message).toContain('"alves2010"');
    expect(result.action?.label).toBe("Buscar e adicionar");
    result.action?.onClick();
    expect(onSearchCitation).toHaveBeenCalledWith("alves2010");
    expect(openFile).not.toHaveBeenCalled();
  });

  it("falls back to opening the .bib when no search callback is wired", () => {
    const openFile = vi.fn();
    const result = translateDiagnostic(citationDiag(), {
      bibPath: "elementos-pos-textuais/referencias.bib",
      openFile,
    });
    expect(result.action?.label).toBe("Ver referências");
    result.action?.onClick();
    expect(openFile).toHaveBeenCalledWith("elementos-pos-textuais/referencias.bib");
  });

  it("omits the action when neither search nor a .bib path is available", () => {
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
