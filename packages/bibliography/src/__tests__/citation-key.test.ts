import { describe, expect, it } from "vitest";
import { buildCitationKey } from "../domain/citation-key";

describe("buildCitationKey", () => {
  it("combines surname + year + first significant title word", () => {
    expect(
      buildCitationKey({
        authorSurname: "Freire",
        year: "1970",
        title: "Pedagogia do Oprimido",
      }),
    ).toBe("freire1970pedagogia");
  });

  it("strips accents", () => {
    expect(
      buildCitationKey({ authorSurname: "Ação", year: "2020", title: "Educação" }),
    ).toBe("acao2020educacao");
  });

  it("skips stopwords when picking the title word", () => {
    expect(
      buildCitationKey({
        authorSurname: "Silva",
        year: "2020",
        title: "A Grande Teoria",
      }),
    ).toBe("silva2020grande");
  });

  it("skips common English stopwords too (found via a real CrossRef result)", () => {
    expect(
      buildCitationKey({
        authorSurname: "Mineault",
        year: "2025",
        title: "Is Attention All You Need?",
      }),
    ).toBe("mineault2025attention");
  });

  it("degrades gracefully with no author", () => {
    expect(buildCitationKey({ year: "2023", title: "Sem Autor Definido" })).toBe(
      "2023sem",
    );
  });

  it("never returns an empty string", () => {
    expect(buildCitationKey({})).toBe("referencia");
  });
});
