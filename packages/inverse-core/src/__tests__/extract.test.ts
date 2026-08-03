import { describe, expect, test } from "vitest";
import { pageBoundsOf, pageRangeOf } from "../extract.js";

describe("pageBoundsOf", () => {
  test("calcula dimensões a partir de uma CropBox deslocada", () => {
    expect(pageBoundsOf([-18, -36, 594, 806])).toEqual({
      width: 612,
      height: 842,
      top: 806,
    });
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
