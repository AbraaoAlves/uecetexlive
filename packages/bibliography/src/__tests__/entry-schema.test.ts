import { describe, expect, it } from "vitest";
import { missingRequiredFields } from "../domain/entry-schema";

describe("missingRequiredFields", () => {
  it("flags a book missing its publisher", () => {
    const fields = new Map([
      ["author", { kind: "braced" as const, value: "Freire, Paulo" }],
      ["title", { kind: "braced" as const, value: "Pedagogia do Oprimido" }],
      ["year", { kind: "braced" as const, value: "1970" }],
    ]);
    expect(missingRequiredFields("book", fields)).toEqual(["publisher"]);
  });

  it("returns an empty list when every required field is present", () => {
    const fields = new Map([["title", { kind: "braced" as const, value: "Algo" }]]);
    expect(missingRequiredFields("misc", fields)).toEqual([]);
  });
});
