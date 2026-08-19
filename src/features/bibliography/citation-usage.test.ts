import { describe, expect, it } from "vitest";
import { countCitationUsages, extractCitedKeys } from "./citation-usage";

const CITE_COMMANDS = ["citeonline", "Citeonline"];

describe("countCitationUsages", () => {
  it("counts a plain \\citeonline{key} usage", () => {
    const sources = { "a.tex": "Texto \\citeonline{freire1970} aqui." };
    expect(countCitationUsages(sources, "freire1970", CITE_COMMANDS)).toBe(1);
  });

  it("counts across multiple files", () => {
    const sources = {
      "a.tex": "\\citeonline{freire1970}",
      "b.tex": "\\Citeonline{freire1970} e depois \\citeonline{freire1970} de novo",
    };
    expect(countCitationUsages(sources, "freire1970", CITE_COMMANDS)).toBe(3);
  });

  it("counts a key inside a multi-key citation", () => {
    const sources = { "a.tex": "\\citeonline{lamport1986,freire1970}" };
    expect(countCitationUsages(sources, "freire1970", CITE_COMMANDS)).toBe(1);
  });

  it("handles an optional [opt] argument before the braces", () => {
    const sources = { "a.tex": "\\citeonline[p. 45]{freire1970}" };
    expect(countCitationUsages(sources, "freire1970", CITE_COMMANDS)).toBe(1);
  });

  it("counts the generic \\cite command used by the project template", () => {
    const sources = { "a.tex": "\\cite{freire1970}" };
    expect(countCitationUsages(sources, "freire1970", CITE_COMMANDS)).toBe(1);
  });

  it("does not false-positive on a key that is a substring of another", () => {
    const sources = { "a.tex": "\\citeonline{freire1970abc}" };
    expect(countCitationUsages(sources, "freire1970", CITE_COMMANDS)).toBe(0);
  });

  it("returns 0 for no usages", () => {
    expect(
      countCitationUsages({ "a.tex": "sem citação" }, "freire1970", CITE_COMMANDS),
    ).toBe(0);
  });
});

describe("extractCitedKeys", () => {
  it("collects every key across every file, deduped", () => {
    const sources = {
      "a.tex": "\\citeonline{freire1970,lamport1986}",
      "b.tex": "\\Citeonline{freire1970}",
    };
    expect(extractCitedKeys(sources, CITE_COMMANDS)).toEqual(
      new Set(["freire1970", "lamport1986"]),
    );
  });

  it("collects generic citations without treating \\nocite as a citation", () => {
    const sources = {
      "a.tex": "\\cite{freire1970} \\citep{lamport1986} \\nocite{knuth}",
    };
    expect(extractCitedKeys(sources, CITE_COMMANDS)).toEqual(
      new Set(["freire1970", "lamport1986"]),
    );
  });

  it("returns an empty set for no citations", () => {
    expect(extractCitedKeys({ "a.tex": "sem citação" }, CITE_COMMANDS)).toEqual(
      new Set(),
    );
  });
});
