/**
 * Comandos de escrita do .bib (§5.5 UI_UX_PLAN) — funções puras,
 * bibText-in/bibText-out, nunca exception. `renameKey` aqui só troca a
 * key dentro do .bib; propagar pros `.tex` do projeto é um comando de
 * projeto à parte (fora deste pacote, respeitando a fronteira do
 * contexto — ver §5.5).
 */
import { parseBibFile, serializeBibFile, serializeEntry } from "./bib-file";
import type {
  BibFieldValue,
  BibFile,
  BibliographyEntry,
  Chunk,
  DomainError,
  EntryPatch,
  NewEntryInput,
  Result,
} from "./types";
import { err, isParseFailure, ok } from "./types";

type EntryChunk = Extract<Chunk, { kind: "entry" }>;

function isResolvedEntryChunk(c: Chunk): c is EntryChunk & { parsed: BibliographyEntry } {
  return c.kind === "entry" && !isParseFailure(c.parsed);
}

function collectKeys(file: BibFile): Set<string> {
  const keys = new Set<string>();
  for (const c of file.chunks) {
    if (isResolvedEntryChunk(c)) keys.add(c.parsed.citationKey);
  }
  return keys;
}

function findEntryIndex(file: BibFile, key: string): number {
  return file.chunks.findIndex(
    (c) => isResolvedEntryChunk(c) && c.parsed.citationKey === key,
  );
}

function findAttemptedKeyMatch(file: BibFile, key: string): boolean {
  return file.chunks.some(
    (c) =>
      c.kind === "entry" && isParseFailure(c.parsed) && c.parsed.attemptedKey === key,
  );
}

function toBibFieldMap(fields: ReadonlyMap<string, string>): Map<string, BibFieldValue> {
  const map = new Map<string, BibFieldValue>();
  for (const [name, value] of fields) map.set(name, { kind: "braced", value });
  return map;
}

/** BibTeX keys can't contain whitespace, commas, or braces (they'd break parsing). */
function isValidKey(key: string): boolean {
  return key.length > 0 && !/[\s,{}]/.test(key);
}

function hasUnbalancedBraces(value: string): boolean {
  let depth = 0;
  for (const ch of value) {
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth < 0) return true;
    }
  }
  return depth !== 0;
}

function validateFields(fields: ReadonlyMap<string, string>): DomainError | null {
  for (const [name, value] of fields) {
    if (hasUnbalancedBraces(value)) {
      return { kind: "InvalidField", field: name, reason: "chaves { } não balanceadas" };
    }
  }
  return null;
}

/** Spreadsheet-style letter suffixes (a, b, ..., z, aa, ab, ...) — never overflows past ASCII a-z. */
function letterSuffix(index: number): string {
  let n = index;
  let suffix = "";
  do {
    suffix = String.fromCharCode(97 + (n % 26)) + suffix;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return suffix;
}

function appendChunkText(bibText: string, newRaw: string): string {
  if (bibText.trim().length === 0) return newRaw;
  const separator = bibText.endsWith("\n\n")
    ? ""
    : bibText.endsWith("\n")
      ? "\n"
      : "\n\n";
  return bibText + separator + newRaw;
}

export interface AddEntryResult {
  readonly bibText: string;
  /** The key actually used — may differ from the proposed one after collision-suffixing. */
  readonly citationKey: string;
}

export function addEntry(bibText: string, input: NewEntryInput): Result<AddEntryResult> {
  const fieldError = validateFields(input.fields);
  if (fieldError) return err(fieldError);
  if (!isValidKey(input.citationKey)) {
    return err({ kind: "InvalidField", field: "citationKey", reason: "chave inválida" });
  }

  const file = parseBibFile(bibText);
  const existingKeys = collectKeys(file);

  let key = input.citationKey;
  if (existingKeys.has(key)) {
    let suffixIndex = 0;
    let candidate: string;
    do {
      candidate = `${input.citationKey}${letterSuffix(suffixIndex)}`;
      suffixIndex++;
    } while (existingKeys.has(candidate));
    key = candidate;
  }

  const entry: BibliographyEntry = {
    citationKey: key,
    entryType: input.entryType,
    fields: toBibFieldMap(input.fields),
  };
  return ok({
    bibText: appendChunkText(bibText, serializeEntry(entry)),
    citationKey: key,
  });
}

export function updateEntry(
  bibText: string,
  key: string,
  patch: EntryPatch,
): Result<string> {
  const file = parseBibFile(bibText);
  const idx = findEntryIndex(file, key);
  if (idx === -1) {
    const malformed = findAttemptedKeyMatch(file, key);
    return err(
      malformed ? { kind: "MalformedEntry", key } : { kind: "KeyNotFound", key },
    );
  }
  if (patch.fields) {
    const fieldError = validateFields(patch.fields);
    if (fieldError) return err(fieldError);
  }

  const current = (file.chunks[idx] as EntryChunk).parsed as BibliographyEntry;
  const next: BibliographyEntry = {
    citationKey: current.citationKey,
    entryType: patch.entryType ?? current.entryType,
    fields: patch.fields ? toBibFieldMap(patch.fields) : current.fields,
  };
  const newChunks = file.chunks.map(
    (c, i): Chunk =>
      i === idx ? { kind: "entry", raw: serializeEntry(next), parsed: next } : c,
  );
  return ok(serializeBibFile({ chunks: newChunks }));
}

export function removeEntry(bibText: string, key: string): Result<string> {
  const file = parseBibFile(bibText);
  const idx = findEntryIndex(file, key);
  if (idx === -1) return err({ kind: "KeyNotFound", key });
  const newChunks = file.chunks.filter((_, i) => i !== idx);
  return ok(serializeBibFile({ chunks: newChunks }));
}

/** Renames the key *inside the .bib only* — see module doc. */
export function renameKey(
  bibText: string,
  oldKey: string,
  newKey: string,
): Result<string> {
  if (!isValidKey(newKey)) {
    return err({ kind: "InvalidField", field: "citationKey", reason: "chave inválida" });
  }
  const file = parseBibFile(bibText);
  const idx = findEntryIndex(file, oldKey);
  if (idx === -1) return err({ kind: "KeyNotFound", key: oldKey });
  if (oldKey !== newKey && collectKeys(file).has(newKey)) {
    return err({ kind: "KeyCollision", key: newKey });
  }
  if (oldKey === newKey) return ok(bibText);
  const current = (file.chunks[idx] as EntryChunk).parsed as BibliographyEntry;
  const renamed: BibliographyEntry = { ...current, citationKey: newKey };
  const newChunks = file.chunks.map(
    (c, i): Chunk =>
      i === idx ? { kind: "entry", raw: serializeEntry(renamed), parsed: renamed } : c,
  );
  return ok(serializeBibFile({ chunks: newChunks }));
}
