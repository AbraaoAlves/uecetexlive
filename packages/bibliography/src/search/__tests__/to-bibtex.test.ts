import { describe, expect, it } from "vitest";
import { candidateToNewEntryInput, escapeBibtex } from "../to-bibtex";
import type { ReferenceCandidate } from "../types";

describe("escapeBibtex", () => {
  it("preserves balanced braces protecting capitalization", () => {
    expect(escapeBibtex("A study of {BERT} representations")).toBe(
      "A study of {BERT} representations",
    );
  });

  it("escapes special LaTeX characters outside braces", () => {
    expect(escapeBibtex("Teoria & Sociedade")).toBe("Teoria \\& Sociedade");
    expect(escapeBibtex("50% growth in R&D_spend #1 ~approx")).toBe(
      "50\\% growth in R\\&D\\_spend \\#1 \\~approx",
    );
  });

  it("does not escape special characters inside braces", () => {
    expect(escapeBibtex("{A & B}")).toBe("{A & B}");
  });
});

const candidate: ReferenceCandidate = {
  source: "crossref",
  doi: "10.1234/example",
  title: "Teoria & {BERT}: um estudo",
  authors: [
    { firstName: "Paulo", lastName: "Freire" },
    { firstName: "", lastName: "UNESCO" },
  ],
  year: "2020",
  venue: "Revista X",
  entryType: "article",
  url: "https://doi.org/10.1234/example",
};

describe("candidateToNewEntryInput", () => {
  it("maps every field and escapes the title/venue/authors", () => {
    const input = candidateToNewEntryInput(candidate);
    expect(input.entryType).toBe("article");
    expect(input.fields.get("title")).toBe("Teoria \\& {BERT}: um estudo");
    expect(input.fields.get("journal")).toBe("Revista X");
    expect(input.fields.get("year")).toBe("2020");
    expect(input.fields.get("doi")).toBe("10.1234/example");
    expect(input.fields.get("author")).toBe("Freire, Paulo and UNESCO");
  });

  it("maps inproceedings venue to booktitle, not journal", () => {
    const input = candidateToNewEntryInput({ ...candidate, entryType: "inproceedings" });
    expect(input.fields.has("journal")).toBe(false);
    expect(input.fields.get("booktitle")).toBe("Revista X");
  });

  it("derives a citation key from the first author, year and title", () => {
    const input = candidateToNewEntryInput(candidate);
    expect(input.citationKey).toBe("freire2020teoria");
  });

  it("never includes the author field when there are no authors", () => {
    const input = candidateToNewEntryInput({ ...candidate, authors: [] });
    expect(input.fields.has("author")).toBe(false);
  });
});
