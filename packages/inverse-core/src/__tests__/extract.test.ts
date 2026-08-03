import { describe, expect, test, vi } from "vitest";
import {
  extractImages,
  extractTextBlocks,
  mapOutline,
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
