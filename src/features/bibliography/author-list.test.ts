import { describe, expect, it } from "vitest";
import { serializeAuthors } from "./author-list";

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
