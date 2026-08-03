import { describe, expect, test, vi } from "vitest";
import {
  extractImages,
  extractTextBlocks,
  extractVectorSegments,
  mapOutline,
  mergeAccentSpans,
  pageBoundsOf,
  pageRangeOf,
  vectorBBoxOf,
} from "../extract.js";

describe("pageBoundsOf", () => {
  test("calcula dimensões a partir de uma CropBox deslocada", () => {
    expect(pageBoundsOf([-18, -36, 594, 806])).toEqual({
      width: 612,
      height: 842,
      left: -18,
      top: 806,
    });
  });
});

describe("vectorBBoxOf", () => {
  test("normaliza vetores pela origem da CropBox", () => {
    expect(vectorBBoxOf([10, 20, 50, 20], { left: 10, top: 100 })).toEqual({
      x0: 0,
      y0: 80,
      x1: 40,
      y1: 80,
    });
  });
});

describe("extractVectorSegments", () => {
  test("avança o ponto atual depois de uma curva", () => {
    expect(
      extractVectorSegments("0 0 m 10 0 20 0 30 0 c 100 0 l S", { left: 0, top: 100 }),
    ).toEqual([
      {
        kind: "vector",
        bbox: { x0: 30, y0: 100, x1: 100, y1: 100 },
        orientation: "horizontal",
        thickness: 1,
      },
    ]);
  });

  test("fecha o subcaminho no ponto em que ele começou", () => {
    const segments = extractVectorSegments("0 0 m 10 0 l 10 10 l 0 10 l h S", {
      left: 0,
      top: 100,
    });

    expect(segments).toContainEqual({
      kind: "vector",
      bbox: { x0: 0, y0: 90, x1: 0, y1: 100 },
      orientation: "vertical",
      thickness: 1,
    });
  });
});

describe("mapOutline", () => {
  test("limita a profundidade de um sumário", () => {
    let outline: { title: string; down?: (typeof outline)[] } = { title: "0" };
    const root = outline;
    for (let index = 1; index <= 40; index += 1) {
      outline.down = [{ title: String(index) }];
      outline = outline.down[0] as typeof outline;
    }

    const mapped = mapOutline([root], { resolveLink: vi.fn() } as never);
    let depth = 0;
    let current = mapped[0];
    while (current) {
      depth += 1;
      current = current.children[0];
    }

    expect(depth).toBe(32);
  });
});

describe("estruturas do MuPDF", () => {
  test("libera o texto estruturado depois de ler texto e imagens", () => {
    const text = { asJSON: () => JSON.stringify({ blocks: [] }), destroy: vi.fn() };
    const images = { walk: vi.fn(), destroy: vi.fn() };
    const page = {
      toStructuredText: vi.fn((mode: string) =>
        mode === "preserve-spans" ? text : images,
      ),
    } as never;

    extractTextBlocks(page, new Map());
    extractImages(page, new Map(), new Map());

    expect(text.destroy).toHaveBeenCalledOnce();
    expect(images.destroy).toHaveBeenCalledOnce();
  });
});

describe("pageRangeOf", () => {
  test("limita intervalos fora das páginas disponíveis", () => {
    expect(pageRangeOf(3, [-2, 9])).toEqual([0, 2]);
  });

  test("preserva um intervalo invertido na última página válida", () => {
    expect(pageRangeOf(3, [9, 1])).toEqual([2, 2]);
  });
});

describe("mergeAccentSpans", () => {
  test("preserva um espaço que não acompanha acento", () => {
    const spans = [
      {
        kind: "text" as const,
        text: "primeira",
        font: "LatinModern",
        size: 10,
        bold: false,
        italic: false,
        bbox: { x0: 0, y0: 0, x1: 30, y1: 10 },
        baseline: 10,
        wmode: 0,
      },
      {
        kind: "text" as const,
        text: " ",
        font: "LatinModern",
        size: 10,
        bold: false,
        italic: false,
        bbox: { x0: 30, y0: 0, x1: 33, y1: 10 },
        baseline: 10,
        wmode: 0,
      },
      {
        kind: "text" as const,
        text: "segunda",
        font: "LatinModern",
        size: 10,
        bold: false,
        italic: false,
        bbox: { x0: 33, y0: 0, x1: 65, y1: 10 },
        baseline: 10,
        wmode: 0,
      },
    ];

    expect(mergeAccentSpans(spans).map((span) => span.text)).toEqual([
      "primeira",
      " ",
      "segunda",
    ]);
  });
});
