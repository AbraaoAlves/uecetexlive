import { expect, it } from "vitest";
import { parseLatex, serializeDoc } from "./index";

it("round-trip byte-idêntico via entry do pacote", () => {
  const src = "\\chapter{Intro}\n\nOlá \\cite{a1}.\n";
  expect(serializeDoc(parseLatex(src).doc)).toBe(src);
});
