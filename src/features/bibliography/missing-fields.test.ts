import { describe, expect, it } from "vitest";
import { entryCountOf, incompleteEntriesOf } from "./missing-fields";

const BIB = `@book{completo2026,
  author = {Silva, Maria},
  title = {Jogos Digitais},
  publisher = {Editora X},
  year = {2026}
}

@book{semeditora2026,
  author = {Souza, João},
  title = {Ensino de Programação},
  year = {2026}
}

@article{semnada2025,
  title = {Um artigo}
}
`;

describe("incompleteEntriesOf", () => {
  it("lista só as incompletas, na ordem do arquivo, com os rótulos em PT", () => {
    const incomplete = incompleteEntriesOf(BIB);
    expect(incomplete.map((e) => e.key)).toEqual(["semeditora2026", "semnada2025"]);
    expect(incomplete[0]?.missing).toEqual(["Editora"]);
    expect(incomplete[1]?.missing.length).toBeGreaterThan(1);
  });

  it("não acha nada num .bib inexistente ou vazio", () => {
    expect(incompleteEntriesOf(null)).toEqual([]);
    expect(incompleteEntriesOf("")).toEqual([]);
  });

  // Tipo desconhecido não tem régua: acusar falta de campo seria inventar.
  it("ignora entrada de tipo que não conhecemos", () => {
    expect(incompleteEntriesOf("@invencao{x2026,\n  title = {T}\n}\n")).toEqual([]);
  });
});

describe("entryCountOf", () => {
  it("conta as entradas que o parser entendeu", () => {
    expect(entryCountOf(BIB)).toBe(3);
    expect(entryCountOf(null)).toBe(0);
  });
});
