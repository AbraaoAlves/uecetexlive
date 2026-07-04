import { describe, expect, it } from "vitest";
import ftSrc from "../../../../public/templates/uecetex2/files/elementos-textuais/fundamentacao-teorica.tex?raw";
import {
  columnCount,
  editCell,
  parseTable,
  serializeTable,
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
    }
  });
});
