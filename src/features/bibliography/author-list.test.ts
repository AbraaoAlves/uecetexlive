import { describe, expect, it } from "vitest";
import { type AuthorInput, parseAuthors, serializeAuthors } from "./author-list";

describe("serializeAuthors", () => {
  it("serializes one author as 'Sobrenome, Nome'", () => {
    expect(serializeAuthors([{ firstName: "Paulo", lastName: "Freire" }])).toBe(
      "Freire, Paulo",
    );
  });

  it("joins multiple authors with ' and '", () => {
    expect(
      serializeAuthors([
        { firstName: "Paulo", lastName: "Freire" },
        { firstName: "Leslie", lastName: "Lamport" },
      ]),
    ).toBe("Freire, Paulo and Lamport, Leslie");
  });

  it("drops fully-empty rows", () => {
    expect(
      serializeAuthors([
        { firstName: "Paulo", lastName: "Freire" },
        { firstName: "", lastName: "" },
      ]),
    ).toBe("Freire, Paulo");
  });

  it("handles a missing first name (organization-as-author)", () => {
    expect(serializeAuthors([{ firstName: "", lastName: "UNESCO" }])).toBe("UNESCO");
  });
});

describe("parseAuthors", () => {
  it("parses a single 'Sobrenome, Nome' author", () => {
    expect(parseAuthors("Freire, Paulo")).toEqual([
      { lastName: "Freire", firstName: "Paulo" },
    ]);
  });

  it("splits on ' and '", () => {
    expect(parseAuthors("Freire, Paulo and Lamport, Leslie")).toEqual([
      { lastName: "Freire", firstName: "Paulo" },
      { lastName: "Lamport", firstName: "Leslie" },
    ]);
  });

  it("treats a no-comma segment as an organization (lastName only)", () => {
    expect(parseAuthors("UNESCO")).toEqual([{ lastName: "UNESCO", firstName: "" }]);
  });

  it("returns one empty row for missing/blank input", () => {
    expect(parseAuthors(undefined)).toEqual([{ firstName: "", lastName: "" }]);
    expect(parseAuthors("  ")).toEqual([{ firstName: "", lastName: "" }]);
  });

  it("round-trips through serializeAuthors", () => {
    const authors: AuthorInput[] = [
      { firstName: "Paulo", lastName: "Freire" },
      { firstName: "Leslie", lastName: "Lamport" },
    ];
    expect(parseAuthors(serializeAuthors(authors))).toEqual(authors);
  });
});
