import { describe, expect, test } from "vitest";
import { pageBoundsOf } from "../extract.js";

describe("pageBoundsOf", () => {
  test("calcula dimensões a partir de uma CropBox deslocada", () => {
    expect(pageBoundsOf([-18, -36, 594, 806])).toEqual({
      width: 612,
      height: 842,
      top: 806,
    });
  });
});
