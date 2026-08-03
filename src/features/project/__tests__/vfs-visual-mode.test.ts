import { describe, expect, it } from "vitest";
import { visualModeFor } from "../vfs";

describe("visualModeFor", () => {
  it("dá a lista de referências para qualquer .bib", () => {
    expect(visualModeFor({ path: "referencias.bib", kind: "bib" })).toBe("bib");
    // Um segundo .bib também tem modo visual — cada um edita o seu.
    expect(visualModeFor({ path: "outra/fonte.bib", kind: "bib" })).toBe("bib");
  });

  it("dá o editor de prosa para capítulos", () => {
    expect(
      visualModeFor({ path: "elementos-textuais/introducao.tex", kind: "tex" }),
    ).toBe("prose");
  });

  it("não dá modo visual ao documento principal nem à configuração", () => {
    expect(visualModeFor({ path: "documento.tex", kind: "tex" })).toBeNull();
    expect(visualModeFor({ path: "configuracoes/pacotes.tex", kind: "tex" })).toBeNull();
  });

  it("não dá modo visual a imagem, PDF ou nenhum arquivo", () => {
    expect(visualModeFor({ path: "figuras/figura-1.png", kind: "image" })).toBeNull();
    expect(visualModeFor({ path: "ficha.pdf", kind: "pdf" })).toBeNull();
    expect(visualModeFor(null)).toBeNull();
  });
});
