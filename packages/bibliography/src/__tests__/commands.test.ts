import { describe, expect, it } from "vitest";
import { addEntry, removeEntry, renameKey, updateEntry } from "../domain/commands";

describe("addEntry", () => {
  it("appends a well-formed entry to the end of an empty file", () => {
    const result = addEntry("", {
      citationKey: "freire1970",
      entryType: "book",
      fields: new Map([
        ["author", "Freire, Paulo"],
        ["title", "Pedagogia do Oprimido"],
        ["publisher", "Paz e Terra"],
        ["year", "1970"],
      ]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.citationKey).toBe("freire1970");
    expect(result.value.bibText).toContain("@book{freire1970,");
    expect(result.value.bibText).toContain("author = {Freire, Paulo}");
  });

  it("never touches existing bytes — Given/When/Then", () => {
    const given = "@misc{a, title = {A}}\n";
    const result = addEntry(given, {
      citationKey: "b",
      entryType: "misc",
      fields: new Map([["title", "B"]]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.bibText.startsWith(given)).toBe(true);
    expect(result.value.bibText).toBe(`${given}\n@misc{b,\n  title = {B}\n}\n`);
  });

  it("resolves a key collision by suffixing a, b, c…", () => {
    const given = addEntry("", {
      citationKey: "freire1970pedagogia",
      entryType: "book",
      fields: new Map([["title", "Pedagogia do Oprimido"]]),
    });
    expect(given.ok).toBe(true);
    if (!given.ok) return;

    const second = addEntry(given.value.bibText, {
      citationKey: "freire1970pedagogia",
      entryType: "book",
      fields: new Map([["title", "Outra obra, mesma key gerada"]]),
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.citationKey).toBe("freire1970pedagogiaa");
    expect(second.value.bibText).toContain("@book{freire1970pedagogiaa,");
    // The first entry's bytes are still there, untouched.
    expect(second.value.bibText.startsWith(given.value.bibText)).toBe(true);

    const third = addEntry(second.value.bibText, {
      citationKey: "freire1970pedagogia",
      entryType: "book",
      fields: new Map([["title", "Uma terceira, mesma key"]]),
    });
    expect(third.ok).toBe(true);
    if (third.ok) {
      expect(third.value.citationKey).toBe("freire1970pedagogiab");
      expect(third.value.bibText).toContain("@book{freire1970pedagogiab,");
    }
  });

  it("suffixes past z with two-letter combinations instead of injecting invalid characters", () => {
    // 28 calls: 1 base + 26 single-letter collisions (a..z) + 1 that overflows to "aa".
    let bibText = "";
    for (let i = 0; i < 28; i++) {
      const result = addEntry(bibText, {
        citationKey: "dup",
        entryType: "misc",
        fields: new Map([["title", `Entry ${i}`]]),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      bibText = result.value.bibText;
      // BibTeX citekeys can't contain whitespace, commas, or braces.
      expect(result.value.citationKey).toMatch(/^[a-z0-9]+$/);
      if (i === 26) expect(result.value.citationKey).toBe("dupz");
      if (i === 27) expect(result.value.citationKey).toBe("dupaa");
    }
    expect(bibText.match(/@misc\{dup[a-z]*,/g)).toHaveLength(28);
  });

  it("rejects a field value with unbalanced braces", () => {
    const result = addEntry("", {
      citationKey: "k",
      entryType: "misc",
      fields: new Map([["title", "Uma { chave sem fechar"]]),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("InvalidField");
  });
});

describe("updateEntry", () => {
  const given = "@article{k,\n  title = {Old},\n  year = {2020}\n}\n";

  it("re-serializes only the target chunk — diff mínimo", () => {
    const other = "@misc{other, title = {Untouched}}\n";
    const combined = `${other}\n${given}`;
    const result = updateEntry(combined, "k", {
      fields: new Map([
        ["title", "Old"],
        ["year", "2021"],
      ]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain(other.trimEnd());
    expect(result.value).toContain("year = {2021}");
    expect(result.value).not.toContain("year = {2020}");
  });

  it("returns KeyNotFound for a key that doesn't exist", () => {
    const result = updateEntry(given, "nope", { fields: new Map() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toEqual({ kind: "KeyNotFound", key: "nope" });
  });

  it("returns MalformedEntry when the target chunk failed to parse", () => {
    const broken = "@article{broken, title = {unterminated\n";
    const result = updateEntry(broken, "broken", { fields: new Map() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("MalformedEntry");
  });
});

describe("removeEntry", () => {
  it("removes exactly the target entry, leaves everything else byte-identical", () => {
    const a = "@misc{a, title = {A}}\n";
    const b = "@misc{b, title = {B}}\n";
    const combined = `${a}\n${b}`;
    const result = removeEntry(combined, "a");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toContain("title = {A}");
    expect(result.value).toContain(b);
  });

  it("returns KeyNotFound for a key that doesn't exist", () => {
    const result = removeEntry("@misc{a, title={A}}", "z");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toEqual({ kind: "KeyNotFound", key: "z" });
  });
});

describe("renameKey", () => {
  it("renames the key and re-serializes only that chunk", () => {
    const other = "@misc{other, title = {Untouched}}\n";
    const combined = `${other}\n@misc{old, title = {X}}\n`;
    const result = renameKey(combined, "old", "new");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain(other.trimEnd());
    expect(result.value).toContain("@misc{new,");
    expect(result.value).not.toContain("@misc{old,");
  });

  it("returns KeyCollision when the new key already exists", () => {
    const combined = "@misc{a, title={A}}\n@misc{b, title={B}}\n";
    const result = renameKey(combined, "a", "b");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toEqual({ kind: "KeyCollision", key: "b" });
  });

  it("returns KeyNotFound when the old key doesn't exist", () => {
    const result = renameKey("@misc{a, title={A}}", "nope", "new");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toEqual({ kind: "KeyNotFound", key: "nope" });
  });

  it("is a no-op collision check when renaming a key to itself", () => {
    const result = renameKey("@misc{a, title={A}}", "a", "a");
    expect(result.ok).toBe(true);
  });

  it("renaming a key to itself doesn't reformat the entry — diff mínimo", () => {
    const given = "@misc{a,title={A}}\n";
    const result = renameKey(given, "a", "a");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(given);
  });
});
