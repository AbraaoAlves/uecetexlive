import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseBibFile, serializeBibFile, serializeEntry } from "../domain/bib-file";
import { addEntry, removeEntry, updateEntry } from "../domain/commands";
import type { BibliographyEntry, EntryType } from "../domain/types";
import { entryTypeName, isParseFailure } from "../domain/types";

const KNOWN_TYPES: EntryType[] = [
  "article",
  "book",
  "inproceedings",
  "incollection",
  "phdthesis",
  "mastersthesis",
  "techreport",
  "unpublished",
  "misc",
];

const key = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9_-]{0,15}$/)
  .filter((s) => s.length > 0);

const fieldName = fc
  .stringMatching(/^[a-z][a-z0-9_-]{0,10}$/)
  .filter((s) => s.length > 0);

// No braces/commas in the base text — kept balanced by construction, then
// occasionally wrapped in one level of {protected braces} to exercise
// "campo com chaves aninhadas" without needing a brace-balance checker here.
const plainValueText = fc
  .string({ minLength: 1, maxLength: 20, unit: "grapheme" })
  .filter((s) => !/[{},]/.test(s) && s.trim().length > 0);
const fieldValueText = fc.oneof(
  plainValueText,
  plainValueText.map((v) => `{${v}} resto`),
);

const entryArb: fc.Arbitrary<BibliographyEntry> = fc
  .tuple(
    key,
    fc.constantFrom(...KNOWN_TYPES),
    fc.uniqueArray(fieldName, { minLength: 1, maxLength: 5 }),
  )
  .chain(([citationKey, entryType, names]) =>
    fc.tuple(...names.map(() => fieldValueText)).map((values) => ({
      citationKey,
      entryType,
      fields: new Map(
        names.map((n, i) => [n, { kind: "braced" as const, value: values[i] ?? "" }]),
      ),
    })),
  );

describe("serialize → parse stability", () => {
  it("a freshly-serialized entry parses back to the same key/type/fields", () => {
    fc.assert(
      fc.property(entryArb, (entryIn) => {
        const text = serializeEntry(entryIn);
        const file = parseBibFile(text);
        // serializeEntry's trailing "\n" is its own TextChunk — correct
        // chunking, not part of the entry — so only the entry chunk itself
        // is asserted on here.
        const chunk = file.chunks.find((c) => c.kind === "entry");
        if (chunk?.kind !== "entry" || isParseFailure(chunk.parsed)) {
          throw new Error(`expected a parsed entry, got: ${JSON.stringify(chunk)}`);
        }
        expect(chunk.parsed.citationKey).toBe(entryIn.citationKey);
        expect(entryTypeName(chunk.parsed.entryType)).toBe(
          entryTypeName(entryIn.entryType),
        );
        expect([...chunk.parsed.fields]).toEqual([...entryIn.fields]);
        // And the file-level round trip is itself stable.
        expect(serializeBibFile(file)).toBe(text);
      }),
      { numRuns: 200 },
    );
  });

  it("editing one entry never changes any other chunk's raw text", () => {
    fc.assert(
      fc.property(fc.array(entryArb, { minLength: 2, maxLength: 6 }), (entries) => {
        const keys = new Set(entries.map((e) => e.citationKey));
        fc.pre(keys.size === entries.length); // no duplicate keys in this run
        const bibText = entries.map(serializeEntry).join("\n");
        const target = entries[Math.floor(entries.length / 2)];
        if (!target) return;

        const result = updateEntry(bibText, target.citationKey, {
          fields: new Map([...target.fields].map(([k, v]) => [k, `${v.value}-edited`])),
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const before = parseBibFile(bibText).chunks.filter((c) => c.kind === "entry");
        const after = parseBibFile(result.value).chunks.filter((c) => c.kind === "entry");
        expect(after).toHaveLength(before.length);
        for (let i = 0; i < before.length; i++) {
          const b = before[i];
          const a = after[i];
          if (b?.kind !== "entry" || isParseFailure(b.parsed)) continue;
          if (b.parsed.citationKey === target.citationKey) continue;
          expect(a?.raw).toBe(b.raw);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("addEntry never touches existing bytes, only appends", () => {
    fc.assert(
      fc.property(
        fc.array(entryArb, { minLength: 0, maxLength: 4 }),
        entryArb,
        (existing, toAdd) => {
          const keys = new Set(existing.map((e) => e.citationKey));
          fc.pre(keys.size === existing.length && !keys.has(toAdd.citationKey));
          const bibText = existing.map(serializeEntry).join("\n");

          const fieldsAsStrings = new Map(
            [...toAdd.fields].map(([k, v]) => [k, v.value]),
          );
          const result = addEntry(bibText, {
            citationKey: toAdd.citationKey,
            entryType: toAdd.entryType,
            fields: fieldsAsStrings,
          });
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          expect(result.value.bibText.startsWith(bibText)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("removeEntry removes exactly the target chunk, nothing else", () => {
    fc.assert(
      fc.property(fc.array(entryArb, { minLength: 1, maxLength: 6 }), (entries) => {
        const keys = new Set(entries.map((e) => e.citationKey));
        fc.pre(keys.size === entries.length);
        const bibText = entries.map(serializeEntry).join("\n");
        const target = entries[0];
        if (!target) return;

        const result = removeEntry(bibText, target.citationKey);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const remainingKeys = parseBibFile(result.value)
          .chunks.filter((c) => c.kind === "entry" && !isParseFailure(c.parsed))
          .map((c) => (c as { parsed: BibliographyEntry }).parsed.citationKey);
        expect(remainingKeys).not.toContain(target.citationKey);
        expect(remainingKeys).toHaveLength(entries.length - 1);
      }),
      { numRuns: 100 },
    );
  });
});
