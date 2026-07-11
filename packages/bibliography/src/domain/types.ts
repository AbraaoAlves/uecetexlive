/**
 * Chunk model (§5.4 UI_UX_PLAN): unrecognized regions of a .bib file are
 * preserved verbatim as opaque chunks, never re-derived from a model —
 * same strategy as packages/latex-mapping, adapted to BibTeX's flatter
 * (non-nested) structure: a sequence of entries/directives/free text,
 * not a markup tree.
 */

export type EntryType =
  | "article"
  | "book"
  | "inproceedings"
  | "incollection"
  | "phdthesis"
  | "mastersthesis"
  | "techreport"
  | "unpublished"
  | "misc";

export const ENTRY_TYPES: readonly EntryType[] = [
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

/** Never lose an entry type the app doesn't model (Zotero/Mendeley exports, abntex2 pseudo-types…). */
export type EntryTypeTag = EntryType | { readonly custom: string };

export function isKnownEntryType(tag: EntryTypeTag): tag is EntryType {
  return typeof tag === "string";
}

export function entryTypeName(tag: EntryTypeTag): string {
  return typeof tag === "string" ? tag : tag.custom;
}

/**
 * Original delimiter is preserved so re-serializing an *untouched* field
 * never changes its byte representation (braced vs quoted vs bare/macro).
 */
export type BibFieldValue =
  | { readonly kind: "braced"; readonly value: string }
  | { readonly kind: "quoted"; readonly value: string }
  | { readonly kind: "bare"; readonly value: string };

export function fieldText(value: BibFieldValue): string {
  return value.value;
}

export function bracedField(value: string): BibFieldValue {
  return { kind: "braced", value };
}

/**
 * `fields` holds every field the entry has, known or not — "known vs.
 * extra" is a projection the form computes from entry-schema.ts, never a
 * second stored map (that would need to stay in sync by hand). `Map`
 * preserves insertion order, so re-serializing in the same order is free.
 */
export interface BibliographyEntry {
  readonly citationKey: string;
  readonly entryType: EntryTypeTag;
  readonly fields: ReadonlyMap<string, BibFieldValue>;
}

export interface ParseFailure {
  readonly reason: string;
  /** Best-effort, display-only — never used to match against a real key. */
  readonly attemptedKey?: string;
}

export function isParseFailure(x: BibliographyEntry | ParseFailure): x is ParseFailure {
  return "reason" in x;
}

export type Chunk =
  | {
      readonly kind: "entry";
      readonly raw: string;
      readonly parsed: BibliographyEntry | ParseFailure;
    }
  | { readonly kind: "text"; readonly raw: string }
  | { readonly kind: "directive"; readonly raw: string };

export interface BibFile {
  readonly chunks: readonly Chunk[];
}

export type DomainError =
  | { readonly kind: "KeyNotFound"; readonly key: string }
  | { readonly kind: "KeyCollision"; readonly key: string }
  | { readonly kind: "MalformedEntry"; readonly key: string }
  | { readonly kind: "InvalidField"; readonly field: string; readonly reason: string };

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DomainError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T>(error: DomainError): Result<T> {
  return { ok: false, error };
}

/**
 * Input for addEntry — a plain object, no BibFieldValue delimiter choices
 * to make (addEntry always renders fields as `{braced}`). `citationKey`
 * is the *proposed* key (from citation-key.ts, possibly user-edited);
 * addEntry never invents one, it only resolves collisions by suffixing.
 */
export interface NewEntryInput {
  readonly citationKey: string;
  readonly entryType: EntryTypeTag;
  readonly fields: ReadonlyMap<string, string>;
}

/**
 * Patch for updateEntry — never includes citationKey (that's renameKey's
 * job, to keep the "rename touches every citation" side effect opt-in and
 * explicit). `fields`, when present, REPLACES the entry's whole field set
 * (not a merge) — the form always starts from the current fields, so it
 * naturally carries forward anything the user didn't touch, including
 * "Outros campos" extras.
 */
export interface EntryPatch {
  readonly entryType?: EntryTypeTag;
  readonly fields?: ReadonlyMap<string, string>;
}
