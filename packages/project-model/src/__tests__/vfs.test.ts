import { describe, expect, it } from "vitest";
import { UECETEX2_STRUCTURE } from "../template-structure";
import {
  bytesToText,
  isSimpleModeVisible,
  isWysiwygEligible,
  kindOf,
  railSectionOf,
  textToBytes,
} from "../vfs";

describe("kindOf", () => {
  it.each([
    ["documento.tex", "tex"],
    ["elementos-pos-textuais/referencias.bib", "bib"],
    ["lib/abntex2-alf.bst", "bst"],
    ["lib/uecetex2.sty", "sty"],
    ["some/abntex2.cls", "cls"],
    ["figuras/figura-1.jpg", "image"],
    ["figuras/figura-3.png", "image"],
    ["figuras/ficha-catalografica.pdf", "pdf"],
    ["figuras/main.cpp", "code"],
    ["LICENSE", "other"],
  ] as const)("%s -> %s", (path, kind) => {
    expect(kindOf(path)).toBe(kind);
  });
});

describe("isWysiwygEligible (§4.1 editable zone)", () => {
  it.each([
    ["elementos-textuais/introducao.tex", true],
    ["elementos-pos-textuais/apendices/lorem-ipsum.tex", true],
    ["elementos-pos-textuais/anexos/exemplo-de-anexo.tex", true],
    ["elementos-pre-textuais/resumo.tex", true],
    ["elementos-pre-textuais/abstract.tex", true],
    ["elementos-pre-textuais/dedicatoria.tex", true],
    ["elementos-pre-textuais/epigrafe.tex", true],
    ["elementos-pre-textuais/agradecimentos.tex", true],
    // source-view-only:
    ["documento.tex", false],
    ["lib/preambulo.tex", false],
    ["lib/uecetex2.sty", false],
    ["elementos-pre-textuais/lista-de-simbolos.tex", false],
    ["elementos-pos-textuais/glossario.tex", false],
    ["figuras/figura-1.jpg", false],
  ])("%s -> %s", (path, eligible) => {
    expect(isWysiwygEligible(UECETEX2_STRUCTURE, path)).toBe(eligible);
  });
});

describe("railSectionOf (§4.6 grouping)", () => {
  it.each([
    ["elementos-pre-textuais/resumo.tex", "preTextual"],
    ["elementos-textuais/introducao.tex", "chapters"],
    ["elementos-pos-textuais/glossario.tex", "postTextual"],
    ["elementos-pos-textuais/apendices/lorem-ipsum.tex", "postTextual"],
    ["lib/uecetex2.sty", "library"],
    ["figuras/figura-1.jpg", "figures"],
    ["figuras/main.cpp", "figures"],
    // Imagens de um projeto vindo do caminho PDF→LaTeX.
    ["figuras-extraidas/img-0fbdf8cf5b5b.png", "figures"],
    ["documento.tex", "root"],
  ])("%s -> %s", (path, section) => {
    expect(railSectionOf(UECETEX2_STRUCTURE, path)).toBe(section);
  });
});

describe("isSimpleModeVisible (modo simples — allowlist de prosa)", () => {
  // Full matrix over the template manifest's 37 paths.
  it.each([
    // chapters
    ["elementos-textuais/introducao.tex", true],
    ["elementos-textuais/fundamentacao-teorica.tex", true],
    ["elementos-textuais/trabalhos-relacionados.tex", true],
    ["elementos-textuais/metodologia.tex", true],
    ["elementos-textuais/resultados.tex", true],
    ["elementos-textuais/conclusao.tex", true],
    // prose pre-textuals
    ["elementos-pre-textuais/resumo.tex", true],
    ["elementos-pre-textuais/abstract.tex", true],
    ["elementos-pre-textuais/dedicatoria.tex", true],
    ["elementos-pre-textuais/epigrafe.tex", true],
    ["elementos-pre-textuais/agradecimentos.tex", true],
    // apêndices / anexos
    ["elementos-pos-textuais/apendices/historico-de-mudancas.tex", true],
    ["elementos-pos-textuais/apendices/lorem-ipsum.tex", true],
    ["elementos-pos-textuais/apendices/termo-de-fiel-depositario.tex", true],
    ["elementos-pos-textuais/anexos/exemplo-de-anexo.tex", true],
    ["elementos-pos-textuais/anexos/dinamica-das-classes-sociais.tex", true],
    // bibliography + figures
    ["elementos-pos-textuais/referencias.bib", true],
    ["figuras/figura-1.jpg", true],
    ["figuras/figura-2.jpg", true],
    ["figuras/figura-3.png", true],
    ["figuras/figura-4.png", true],
    ["figuras/figura-5.png", true],
    ["figuras/ficha-catalografica.pdf", true],
    ["figuras/main.cpp", true],
    ["figuras/uecetex2-logo-dark-mode.png", true],
    ["figuras/uecetex2-logo-light-mode.png", true],
    ["figuras-extraidas/img-0fbdf8cf5b5b.png", true],
    // hidden: structural
    ["documento.tex", false],
    ["LICENSE", false],
    ["lib/preambulo.tex", false],
    ["lib/uecetex2.sty", false],
    ["lib/abntex2-alf.bst", false],
    ["lib/logo-uece.png", false],
    ["elementos-pre-textuais/errata.tex", false],
    ["elementos-pre-textuais/ficha-catalografica.pdf", false],
    ["elementos-pre-textuais/lista-de-abreviaturas-e-siglas.tex", false],
    ["elementos-pre-textuais/lista-de-simbolos.tex", false],
    ["elementos-pos-textuais/glossario.tex", false],
  ])("%s -> %s", (path, visible) => {
    expect(isSimpleModeVisible(UECETEX2_STRUCTURE, path)).toBe(visible);
  });
});

describe("text round-trip (binary fidelity)", () => {
  it("utf-8 round-trips including accents", () => {
    const s = "Ciência da Computação — çãõ\n% comment\n";
    expect(bytesToText(textToBytes(s))).toBe(s);
  });
});
