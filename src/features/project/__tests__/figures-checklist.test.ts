import { describe, expect, it } from "vitest";
import fundamentacaoTeoricaTex from "../../../../public/templates/uecetex2/files/elementos-textuais/fundamentacao-teorica.tex?raw";
import { checkFigures } from "../figures-checklist";

describe("checkFigures", () => {
  it("finds a template-authored figure with \\Caption + \\UECEfig{}{...}{\\Fonte{...}}", () => {
    const figures = checkFigures(fundamentacaoTeoricaTex);
    expect(figures.length).toBeGreaterThan(0);
    expect(figures[0]).toEqual({ hasCaption: true, hasFonte: true });
  });

  it("flags a plain editor-generated figure (caption, no fonte) as missing fonte", () => {
    const source = `
\\begin{figure}[htb]
\\centering
\\caption{Minha figura}
\\includegraphics[width=8cm]{figuras/figura-1}
\\end{figure}
`;
    expect(checkFigures(source)).toEqual([{ hasCaption: true, hasFonte: false }]);
  });

  it("flags a figure with neither caption nor fonte", () => {
    const source = `
\\begin{figure}[htb]
\\includegraphics[width=8cm]{figuras/figura-1}
\\end{figure}
`;
    expect(checkFigures(source)).toEqual([{ hasCaption: false, hasFonte: false }]);
  });

  it("finds \\fonte/\\Nota nested inside another macro's argument", () => {
    const source = `
\\begin{figure}
\\Caption{X}
\\UECEfig{}{img}{\\Nota{Elaborado pelo autor}}
\\end{figure}
`;
    expect(checkFigures(source)).toEqual([{ hasCaption: true, hasFonte: true }]);
  });

  it("returns one entry per figure environment", () => {
    const source = `
\\begin{figure}
\\caption{A}
\\end{figure}
\\begin{figure}
\\caption{B}
\\Fonte{Autor}
\\end{figure}
`;
    expect(checkFigures(source)).toEqual([
      { hasCaption: true, hasFonte: false },
      { hasCaption: true, hasFonte: true },
    ]);
  });

  it("returns an empty array when there are no figures", () => {
    expect(checkFigures("Texto sem figuras.")).toEqual([]);
  });

  it("returns an empty array on unparseable source", () => {
    expect(checkFigures("\\begin{figure")).toEqual([]);
  });
});
