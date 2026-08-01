import { describe, expect, it } from "vitest";
import {
  extractImprimirToggles,
  TOGGLE_FILES,
  TOGGLE_LISTS,
} from "@/features/project/imprimir-toggles";
import documentoTex from "../../../../public/templates/uecetex2/files/documento.tex?raw";
import {
  AUTOMATIC_LISTS,
  LANGUAGE_ELEMENT,
  OPTIONAL_PAGES,
  optionalPagePath,
} from "../optional-elements";

const toggles = extractImprimirToggles(documentoTex);

describe("catálogo de elementos opcionais", () => {
  it("cobre exatamente as páginas com arquivo próprio", () => {
    expect(OPTIONAL_PAGES.map((e) => e.macro).sort()).toEqual(
      [...TOGGLE_FILES.keys()].sort(),
    );
  });

  it("toda página aponta para um arquivo do modelo", () => {
    for (const page of OPTIONAL_PAGES) {
      expect(optionalPagePath(page.macro)).toBeDefined();
    }
  });

  it("as listas automáticas saem de TOGGLE_LISTS", () => {
    for (const list of AUTOMATIC_LISTS) {
      expect(TOGGLE_LISTS).toContain(list.macro);
    }
  });

  it("apêndices e anexos ficam de fora — desligá-los deixaria os capítulos no PDF", () => {
    const macros = AUTOMATIC_LISTS.map((e) => e.macro);
    expect(macros).not.toContain("imprimirapendices");
    expect(macros).not.toContain("imprimiranexos");
  });

  it("toda macro do catálogo existe no modelo vendorado", () => {
    for (const element of [...OPTIONAL_PAGES, ...AUTOMATIC_LISTS, LANGUAGE_ELEMENT]) {
      expect(toggles.has(element.macro)).toBe(true);
    }
  });

  it("nenhum rótulo usa jargão de LaTeX", () => {
    for (const element of [...OPTIONAL_PAGES, ...AUTOMATIC_LISTS, LANGUAGE_ELEMENT]) {
      expect(element.label).not.toMatch(/macro|comando|latex|\\\\/i);
    }
  });
});
