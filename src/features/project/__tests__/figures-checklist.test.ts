import { describe, expect, it } from "vitest";
import fundamentacaoTeoricaTex from "../../../../public/templates/uecetex2/files/elementos-textuais/fundamentacao-teorica.tex?raw";
import { checkFigures } from "../figures-checklist";

// Todo `.tex` do modelo distribuído, não só os capítulos que hoje têm figura:
// a régua de conformidade não pode acusar o material que o próprio aplicativo
// entrega, e um capítulo novo com figura entra nesta prova sozinho.
const TEMPLATE_TEX = import.meta.glob(
  "../../../../public/templates/uecetex2/files/**/*.tex",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

describe("checkFigures", () => {
  it("finds a template-authored figure with \\Caption + \\UECEfig{}{...}{\\Fonte{...}}", () => {
    const figures = checkFigures(fundamentacaoTeoricaTex);
    expect(figures.length).toBeGreaterThan(0);
    expect(figures[0]).toMatchObject({ hasCaption: true, hasFonte: true });
  });

  it("does not flag any figure shipped with the template", () => {
    const offenders: string[] = [];
    let seen = 0;
    for (const [path, source] of Object.entries(TEMPLATE_TEX)) {
      for (const figure of checkFigures(source)) {
        seen++;
        if (figure.hasCaption && figure.hasFonte) continue;
        offenders.push(
          `${path}#${figure.index + 1} (legenda: ${figure.hasCaption}, fonte: ${figure.hasFonte})`,
        );
      }
    }

    expect(seen).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it("flags a plain editor-generated figure (caption, no fonte) as missing fonte", () => {
    const source = `
\\begin{figure}[htb]
\\centering
\\caption{Minha figura}
\\includegraphics[width=8cm]{figuras/figura-1}
\\end{figure}
`;
    expect(checkFigures(source)).toMatchObject([{ hasCaption: true, hasFonte: false }]);
  });

  it("flags a figure with neither caption nor fonte", () => {
    const source = `
\\begin{figure}[htb]
\\includegraphics[width=8cm]{figuras/figura-1}
\\end{figure}
`;
    expect(checkFigures(source)).toMatchObject([{ hasCaption: false, hasFonte: false }]);
  });

  it("finds \\Fonte nested inside another macro's argument", () => {
    const source = `
\\begin{figure}
\\Caption{X}
\\UECEfig{}{img}{\\Fonte{Elaborado pelo autor}}
\\end{figure}
`;
    expect(checkFigures(source)).toMatchObject([{ hasCaption: true, hasFonte: true }]);
  });

  it("does not treat \\Nota alone as a source", () => {
    const source = `
\\begin{figure}
\\Caption{X}
\\UECEfig{}{img}{\\Nota{Explicação complementar}}
\\end{figure}
`;
    expect(checkFigures(source)).toMatchObject([{ hasCaption: true, hasFonte: false }]);
  });

  it.each([
    "\\Fonte{}",
    "\\Fonte{   }",
    "\\UECEfig{}{img}{\\Fonte{}}",
  ])("does not treat an empty %s as a source", (fonteMacro) => {
    const source = `
\\begin{figure}
\\caption{X}
${fonteMacro}
\\end{figure}
`;
    expect(checkFigures(source)).toMatchObject([{ hasCaption: true, hasFonte: false }]);
  });

  it("keeps \\Fonte with an optional label as a source", () => {
    const source = `
\\begin{figure}
\\caption{X}
\\Fonte[Nota]{Elaborado pelo autor}
\\end{figure}
`;
    expect(checkFigures(source)).toMatchObject([{ hasCaption: true, hasFonte: true }]);
  });

  it("treats a source-prefixed \\legend as a source", () => {
    const source = `
\\begin{figure}
\\caption{X}
\\legend{Fonte: Acervo do autor}
\\end{figure}
`;
    expect(checkFigures(source)).toMatchObject([{ hasCaption: true, hasFonte: true }]);
  });

  it("does not treat a note-prefixed \\legend as a source", () => {
    const source = `
\\begin{figure}
\\caption{X}
\\legend{Nota: Explicação complementar}
\\end{figure}
`;
    expect(checkFigures(source)).toMatchObject([{ hasCaption: true, hasFonte: false }]);
  });

  it("accepts the literal figure shape emitted by PDF import", () => {
    const source = `
\\begin{figure}[htbp]
  \\centering
  \\fbox{\\parbox[c][0.22\\textheight][c]{0.82\\linewidth}{\\centering Imagem não recuperada\\\\\\small figura.png}}
  \\caption{Figura importada}
  \\legend{Fonte: Documento importado, p. 3}
\\end{figure}
`;
    expect(checkFigures(source)).toMatchObject([{ hasCaption: true, hasFonte: true }]);
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
    expect(checkFigures(source)).toMatchObject([
      { hasCaption: true, hasFonte: false },
      { hasCaption: true, hasFonte: true },
    ]);
  });

  it("returns the line, ordinal and visible caption for each figure", () => {
    const source = [
      "Texto",
      "\\begin{figure}",
      "\\Caption{\\label{fig:primeira} Primeira figura}",
      "\\Fonte{Autor}",
      "\\end{figure}",
      "Entre figuras",
      "\\begin{figure}",
      "\\Fonte{Autor}",
      "\\end{figure}",
      "\\begin{figure}",
      "\\caption{Terceira figura}",
      "\\end{figure}",
    ].join("\n");

    expect(checkFigures(source)).toEqual([
      {
        hasCaption: true,
        hasFonte: true,
        line: 2,
        index: 0,
        caption: "Primeira figura",
      },
      {
        hasCaption: false,
        hasFonte: true,
        line: 7,
        index: 1,
        caption: null,
      },
      {
        hasCaption: true,
        hasFonte: false,
        line: 10,
        index: 2,
        caption: "Terceira figura",
      },
    ]);
  });

  it.each([
    "\\caption{}",
    "\\caption{   }",
  ])("keeps an empty caption present but returns null text for %s", (captionMacro) => {
    const source = `\\begin{figure}\n${captionMacro}\n\\end{figure}`;
    expect(checkFigures(source)).toEqual([
      {
        hasCaption: true,
        hasFonte: false,
        line: 1,
        index: 0,
        caption: null,
      },
    ]);
  });

  it("returns an empty array when there are no figures", () => {
    expect(checkFigures("Texto sem figuras.")).toEqual([]);
  });

  it("returns an empty array on unparseable source", () => {
    expect(checkFigures("\\begin{figure")).toEqual([]);
  });
});
