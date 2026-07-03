import { describe, expect, it } from "vitest";
import {
  bytesToText,
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
    expect(isWysiwygEligible(path)).toBe(eligible);
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
    ["documento.tex", "root"],
  ])("%s -> %s", (path, section) => {
    expect(railSectionOf(path)).toBe(section);
  });
});

describe("text round-trip (binary fidelity)", () => {
  it("utf-8 round-trips including accents", () => {
    const s = "Ciência da Computação — çãõ\n% comment\n";
    expect(bytesToText(textToBytes(s))).toBe(s);
  });
});
