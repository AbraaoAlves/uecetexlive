import { describe, expect, it } from "vitest";
import { formatAuthorsList } from "./format-authors";

describe("formatAuthorsList", () => {
  it("formats a single 'Surname, First' author", () => {
    expect(formatAuthorsList("Lamport, Leslie")).toBe("Lamport, L.");
  });

  it("formats multiple authors joined by 'and'", () => {
    expect(formatAuthorsList("Freire, Paulo and Lamport, Leslie")).toBe(
      "Freire, P.; Lamport, L.",
    );
  });

  it("handles 'First Last' order without a comma", () => {
    expect(formatAuthorsList("Leslie Lamport")).toBe("Lamport, L.");
  });

  it("truncates with 'et al.' beyond 3 authors", () => {
    const nine =
      "Wessberg, Johan and Stambaugh, Christopher R and Kralik, Jerald D and " +
      "Beck, Pamela D and Laubach, Mark and Chapin, John K and Kim, Jung and " +
      "Biggs, S James and Srinivasan, Mandayam A";
    expect(formatAuthorsList(nine)).toBe(
      "Wessberg, J.; Stambaugh, C.; Kralik, J. et al.",
    );
  });

  it("returns null for empty/missing input", () => {
    expect(formatAuthorsList(undefined)).toBeNull();
    expect(formatAuthorsList("  ")).toBeNull();
  });

  it("keeps a single-word organization name as-is", () => {
    expect(formatAuthorsList("UNESCO")).toBe("UNESCO");
  });
});
