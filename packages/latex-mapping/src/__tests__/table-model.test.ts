import { describe, expect, it } from "vitest";
import ftSrc from "../../../../public/templates/uecetex2/files/elementos-textuais/fundamentacao-teorica.tex?raw";
import {
  columnCount,
  editCaption,
  editCell,
  editFonte,
  insertRow,
  parseTable,
  removeRow,
  serializeTable,
  tableCaption,
  tableFonte,
  tableGrid,
} from "../table-model";

const SIMPLE = `\\begin{tabular}{cll}
\t\\toprule
\tRanking & Coverage & Support \\\\
\t\\midrule
\tE1 & Complete & Both \\\\
\tE2 & Partial & One \\\\
\t\\bottomrule
\\end{tabular}`;

/**
 * A forma que o importador de PDF escreve: uma coluna `p{}` medida por coluna,
 * ou seja, chave dentro do colspec. Fixture escrita à mão e anônima — nada de
 * texto de trabalho real (regra 8 do contrato).
 */
const IMPORTED_QUADRO = `\\begin{quadro}[htb]
\\centering
\\Caption{\\label{qua:criterios} Critérios comparados}
\\UECEqua{}{
\\begin{tabular}{p{0.4800\\dimexpr\\textwidth-4\\tabcolsep\\relax}p{0.4800\\dimexpr\\textwidth-4\\tabcolsep\\relax}}
\\hline
Critério & Resultado \\\\
\\hline
Cobertura & Total \\\\
\\hline
Suporte & Parcial \\\\
\\hline
\\end{tabular}
}{
\\Fonte{Elaborado pelo autor}
}
\\end{quadro}`;

const WRAPPED = `\\begin{table}[ht!]
\t\\centering
\t\\Caption{\\label{tab:x} Uma legenda}
\t\\UECEtab{}{
\t\t${SIMPLE.split("\n").join("\n\t\t")}
\t}{
\t\t\\Fonte{Elaborado pelo autor}
\t}
\\end{table}`;

describe("parseTable / serializeTable", () => {
  it("round-trips byte-exact when nothing is edited", () => {
    const model = parseTable(SIMPLE);
    expect(model).not.toBeNull();
    expect(serializeTable(model as never)).toBe(SIMPLE);
  });

  it("round-trips a wrapped UECEtab table byte-exact", () => {
    const model = parseTable(WRAPPED);
    expect(model).not.toBeNull();
    expect(serializeTable(model as never)).toBe(WRAPPED);
  });

  it("extracts a grid of cells, ignoring rule lines", () => {
    const grid = tableGrid(parseTable(SIMPLE) as never);
    expect(grid).toEqual([
      ["Ranking", "Coverage", "Support"],
      ["E1", "Complete", "Both"],
      ["E2", "Partial", "One"],
    ]);
    expect(columnCount(parseTable(SIMPLE) as never)).toBe(3);
  });

  it("edits a single cell and rewrites only that row", () => {
    const model = parseTable(SIMPLE) as never;
    const edited = editCell(model, 1, 1, "Full coverage");
    const out = serializeTable(edited);
    expect(out).toContain("E1 & Full coverage & Both \\\\");
    // Other rows untouched (verbatim), rules preserved.
    expect(out).toContain("Ranking & Coverage & Support \\\\");
    expect(out).toContain("\\toprule");
    expect(out).toContain("\\midrule");
    expect(out).toContain("E2 & Partial & One \\\\");
    // Pre/post wrappers identical.
    expect(out.startsWith("\\begin{tabular}{cll}")).toBe(true);
    expect(out.endsWith("\\end{tabular}")).toBe(true);
  });

  it("preserves the header/other cells when editing the header", () => {
    const model = parseTable(WRAPPED) as never;
    const edited = editCell(model, 0, 0, "Classe");
    const out = serializeTable(edited);
    expect(out).toContain("Classe & Coverage & Support \\\\");
    expect(out).toContain("\\Fonte{Elaborado pelo autor}");
    expect(out).toContain("\\Caption{\\label{tab:x} Uma legenda}");
  });

  it("escaped ampersands do not split cells", () => {
    const src = "\\begin{tabular}{ll}\nA \\& B & C \\\\\n\\end{tabular}";
    const grid = tableGrid(parseTable(src) as never);
    expect(grid).toEqual([["A \\& B", "C"]]);
  });

  it("rejects nested tabulars (keeps read-only projection)", () => {
    const nested =
      "\\begin{tabular}{c}\n\\begin{tabular}{c}\nX \\\\\n\\end{tabular} \\\\\n\\end{tabular}";
    expect(parseTable(nested)).toBeNull();
  });

  it("returns null when there is no tabular", () => {
    expect(parseTable("\\begin{table}\\centering plain\\end{table}")).toBeNull();
  });

  it("parses a colspec with braces, as the PDF importer writes it", () => {
    const model = parseTable(IMPORTED_QUADRO);

    expect(model).not.toBeNull();
    expect(tableGrid(model as never)).toEqual([
      ["Critério", "Resultado"],
      ["Cobertura", "Total"],
      ["Suporte", "Parcial"],
    ]);
    expect(columnCount(model as never)).toBe(2);
    // O colspec inteiro, não truncado no primeiro `}` de dentro do `p{}`.
    expect((model as never as { colspec: string }).colspec).toBe(
      "p{0.4800\\dimexpr\\textwidth-4\\tabcolsep\\relax}" +
        "p{0.4800\\dimexpr\\textwidth-4\\tabcolsep\\relax}",
    );
    expect(serializeTable(model as never)).toBe(IMPORTED_QUADRO);
  });

  it.each([
    ["@{}ll@{}", "\\begin{tabular}{@{}ll@{}}\nA & B \\\\\n\\end{tabular}"],
    ["p{3cm}|l", "\\begin{tabular}{p{3cm}|l}\nA & B \\\\\n\\end{tabular}"],
    [
      ">{\\centering\\arraybackslash}p{2cm}l",
      "\\begin{tabular}{>{\\centering\\arraybackslash}p{2cm}l}\nA & B \\\\\n\\end{tabular}",
    ],
    ["[t]{ll}", "\\begin{tabular}[t]{ll}\nA & B \\\\\n\\end{tabular}"],
  ])("reads the colspec %s and round-trips it byte-exact", (_spec, source) => {
    const model = parseTable(source);
    expect(model).not.toBeNull();
    expect(tableGrid(model as never)).toEqual([["A", "B"]]);
    expect(serializeTable(model as never)).toBe(source);
  });

  it("returns null when the colspec group never closes", () => {
    expect(parseTable("\\begin{tabular}{p{3cm\nA & B \\\\\n\\end{tabular}")).toBeNull();
  });

  it("insere linha entre traços e mantém verbatim o que não foi tocado", () => {
    const model = parseTable(IMPORTED_QUADRO) as never;
    const out = serializeTable(insertRow(model, 1));

    expect(out).toContain(
      [
        "Cobertura & Total \\\\",
        "\\hline",
        " &  \\\\",
        "\\hline",
        "Suporte & Parcial \\\\",
      ].join("\n"),
    );
    // Cabeçalho, legenda e fonte saem exatamente como entraram.
    expect(out).toContain("Critério & Resultado \\\\");
    expect(out).toContain("\\Caption{\\label{qua:criterios} Critérios comparados}");
    expect(out).toContain("\\Fonte{Elaborado pelo autor}");
    expect(tableGrid(parseTable(out) as never)).toHaveLength(4);
  });

  it("insere depois da última linha sem passar do traço de fechamento", () => {
    const out = serializeTable(insertRow(parseTable(SIMPLE) as never, 2));

    expect(out).toContain(
      ["E2 & Partial & One \\\\", "\t &  &  \\\\", "\t\\bottomrule"].join("\n"),
    );
    expect(out.endsWith("\\end{tabular}")).toBe(true);
  });

  it("remove a linha e o traço que sobraria, preservando o fechamento", () => {
    const semMeio = serializeTable(removeRow(parseTable(IMPORTED_QUADRO) as never, 1));
    expect(tableGrid(parseTable(semMeio) as never)).toEqual([
      ["Critério", "Resultado"],
      ["Suporte", "Parcial"],
    ]);
    expect(semMeio).toContain("\\hline\n\\end{tabular}");

    const semUltima = serializeTable(removeRow(parseTable(SIMPLE) as never, 2));
    expect(tableGrid(parseTable(semUltima) as never)).toEqual([
      ["Ranking", "Coverage", "Support"],
      ["E1", "Complete", "Both"],
    ]);
    expect(semUltima).toContain("\\bottomrule");
  });

  it("não deixa a tabela sem nenhuma linha de conteúdo", () => {
    const model = parseTable("\\begin{tabular}{ll}\nA & B \\\\\n\\end{tabular}") as never;
    expect(removeRow(model, 0)).toBe(model);
  });

  it("edita legenda e fonte sem perder o rótulo nem o resto do bloco", () => {
    const model = parseTable(IMPORTED_QUADRO) as never;

    expect(tableCaption(model)).toBe("Critérios comparados");
    expect(tableFonte(model)).toBe("Elaborado pelo autor");

    const out = serializeTable(
      editFonte(editCaption(model, "Critérios revisados"), "Pesquisa direta"),
    );
    expect(out).toContain("\\Caption{\\label{qua:criterios} Critérios revisados}");
    expect(out).toContain("\\Fonte{Pesquisa direta}");
    expect(out).toContain("Cobertura & Total \\\\");
    expect(tableCaption(parseTable(out) as never)).toBe("Critérios revisados");
  });

  it("não inventa legenda nem fonte onde não existem", () => {
    const model = parseTable(SIMPLE) as never;
    expect(tableCaption(model)).toBeNull();
    expect(tableFonte(model)).toBeNull();
    expect(serializeTable(editCaption(model, "X"))).toBe(SIMPLE);
    expect(serializeTable(editFonte(model, "Y"))).toBe(SIMPLE);
  });

  it("parses every real template UECEtab/tabular byte-exact", () => {
    // Pull each \begin{tabular}...\end{tabular} slice from the chapter and
    // confirm the model round-trips it unchanged.
    const re = /\\begin\{tabular\}[\s\S]*?\\end\{tabular\}/g;
    const slices = ftSrc.match(re) ?? [];
    expect(slices.length).toBeGreaterThan(0);
    for (const slice of slices) {
      const model = parseTable(slice);
      expect(model, slice.slice(0, 40)).not.toBeNull();
      expect(serializeTable(model as never)).toBe(slice);
      // Não basta não devolver `null`: cada tabela do modelo tem de virar
      // grade de verdade, ou o aluno vê código onde devia ver células.
      expect(tableGrid(model as never).length, slice.slice(0, 40)).toBeGreaterThan(0);
      expect(columnCount(model as never), slice.slice(0, 40)).toBeGreaterThan(0);
    }
  });
});
