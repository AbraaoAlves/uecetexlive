import { describe, expect, it } from "vitest";
import { classify } from "../classify.js";
import type { DocumentIR, PageIR, TextLine, TextSpan } from "../ir.js";

const PAGE_WIDTH = 595;

function line(
  text: string,
  y: number,
  options: { bold?: boolean; size?: number; x0?: number; x1?: number } = {},
): TextLine {
  const x0 = options.x0 ?? 85;
  const x1 = options.x1 ?? x0 + Math.max(text.length * 5, 20);
  const span: TextSpan = {
    kind: "text",
    text,
    font: options.bold ? "NimbusRomNo9L-Medi" : "NimbusRomNo9L-Regu",
    size: options.size ?? 11,
    bold: options.bold ?? false,
    italic: false,
    bbox: { x0, y0: y, x1, y1: y + 12 },
    baseline: y + 10,
    wmode: 0,
  };
  return {
    kind: "line",
    bbox: span.bbox,
    spans: [span],
  };
}

function page(index: number, lines: TextLine[]): PageIR {
  return {
    index,
    width: PAGE_WIDTH,
    height: 842,
    blocks: [
      {
        kind: "textBlock",
        bbox: { x0: 0, y0: 0, x1: PAGE_WIDTH, y1: 842 },
        lines,
      },
    ],
    images: [],
    vectors: [],
    links: [],
  };
}

function document(pages: PageIR[]): DocumentIR {
  return {
    sourceSha256: "0".repeat(64),
    pageCount: pages.length,
    metadata: {},
    outline: [],
    fonts: [],
    pages,
  };
}

describe("classify", () => {
  it("keeps one bibliography entry joined across a page break", () => {
    const result = classify(
      document([
        page(0, [
          line("REFERÊNCIAS", 80, { bold: true, x0: 230, x1: 365 }),
          line("SILVA, Ana. Um título que continua", 130),
        ]),
        page(1, [line("na página seguinte. Fortaleza: Editora, 2024.", 80)]),
      ]),
    );

    expect(result.bibliography).toEqual([
      {
        raw: "SILVA, Ana. Um título que continua na página seguinte. Fortaleza: Editora, 2024.",
        emphasized: [],
        page: 0,
      },
    ]);
  });

  it("does not borrow the source from the next float", () => {
    const result = classify(
      document([
        page(0, [line("1 INTRODUÇÃO", 80, { bold: true })]),
        page(1, [
          line("Figura 1 – Primeira", 100, { bold: true }),
          line("Figura 2 – Segunda", 300, { bold: true }),
          line("Fonte: Acervo correto", 420, { size: 10 }),
        ]),
      ]),
    );
    const figures = result.body.filter((node) => node.kind === "figure");

    expect(figures).toHaveLength(2);
    expect(figures[0]?.source).toBeUndefined();
    expect(figures[1]?.source).toBe("Acervo correto");
  });
});
