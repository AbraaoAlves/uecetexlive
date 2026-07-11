/**
 * Parser/serializer próprio (ADR-01, docs/decisions.md): não usa
 * `@retorquere/bibtex-parser` (esse expande macros e não serve pro
 * round-trip literal que o CRUD exige) nem `bibtex-tidy`.
 *
 * Estratégia: encontrar cada bloco `@tipo{...}`/`@tipo(...)` por
 * contagem de profundidade de chaves (as chaves usadas dentro de valores
 * de campo, mesmo delimitados por aspas, têm que estar balanceadas em
 * BibTeX válido — então contar só chaves já acha o fim correto do bloco
 * mesmo quando o delimitador externo é parêntese). Tudo que não é um
 * bloco `@...` reconhecido vira TextChunk, preservado byte a byte.
 */
import type {
  BibFieldValue,
  BibFile,
  BibliographyEntry,
  Chunk,
  EntryType,
  EntryTypeTag,
  ParseFailure,
} from "./types";
import { ENTRY_TYPES, entryTypeName } from "./types";

const DIRECTIVE_TYPES = new Set(["string", "preamble", "comment"]);
const TYPE_NAME = /^@([A-Za-z]+)[ \t]*/;
const FIELD_NAME = /^[A-Za-z0-9_.:-]+/;
const WHITESPACE_OR_COMMA = /[\s,]/;
const WHITESPACE = /\s/;

interface BlockSpan {
  /** Position right after the opening delimiter. */
  readonly contentStart: number;
  /** Position of the closing delimiter itself. */
  readonly contentEnd: number;
  /** Position right after the closing delimiter. */
  readonly blockEnd: number;
}

/** Depth-counts braces from the opening delimiter to find its match. */
function findBlockSpan(text: string, openPos: number): BlockSpan | null {
  const open = text[openPos];
  const close = open === "(" ? ")" : "}";
  let depth = 0;
  for (let j = openPos; j < text.length; j++) {
    const ch = text[j];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0 && close === "}")
        return { contentStart: openPos + 1, contentEnd: j, blockEnd: j + 1 };
      if (depth < 0) return null; // stray '}' before the outer paren closed
    } else if (ch === close && close === ")" && depth === 0) {
      return { contentStart: openPos + 1, contentEnd: j, blockEnd: j + 1 };
    }
  }
  return null;
}

function skipWs(text: string, pos: number, limit: number): number {
  let j = pos;
  while (j < limit && WHITESPACE.test(text[j] ?? "")) j++;
  return j;
}

/** Reads one field value starting at `pos`; `limit` is the entry's content end. */
function readFieldValue(
  text: string,
  pos: number,
  limit: number,
): { value: BibFieldValue; end: number } | null {
  const ch = text[pos];
  if (ch === "{") {
    let depth = 0;
    for (let j = pos; j < limit; j++) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") {
        depth--;
        if (depth === 0)
          return { value: { kind: "braced", value: text.slice(pos + 1, j) }, end: j + 1 };
      }
    }
    return null;
  }
  if (ch === '"') {
    let depth = 0;
    for (let j = pos + 1; j < limit; j++) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") depth--;
      else if (text[j] === '"' && depth === 0) {
        return { value: { kind: "quoted", value: text.slice(pos + 1, j) }, end: j + 1 };
      }
    }
    return null;
  }
  // Bare token (number, macro reference like `month = jan`, or an
  // unquoted pseudo-field value as seen in abntex2-options.bib).
  let depth = 0;
  let j = pos;
  for (; j < limit; j++) {
    const c = text[j];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === "," && depth === 0) break;
  }
  const raw = text.slice(pos, j);
  return { value: { kind: "bare", value: raw.trim() }, end: pos + raw.length };
}

/** Parses `key, field = value, field = value` inside an entry's braces. */
function parseFields(
  text: string,
  start: number,
  limit: number,
): ReadonlyMap<string, BibFieldValue> | null {
  const fields = new Map<string, BibFieldValue>();
  let j = start;
  while (j < limit) {
    while (j < limit && WHITESPACE_OR_COMMA.test(text[j] ?? "")) j++;
    if (j >= limit) break;
    const nameMatch = text.slice(j, limit).match(FIELD_NAME);
    if (!nameMatch) return null;
    const rawName = nameMatch[0];
    j += rawName.length;
    j = skipWs(text, j, limit);
    if (text[j] !== "=") return null;
    j++;
    j = skipWs(text, j, limit);
    const read = readFieldValue(text, j, limit);
    if (!read) return null;
    fields.set(rawName.toLowerCase(), read.value);
    j = read.end;
  }
  return fields;
}

/** Best-effort key sniff for a block whose fields failed to parse — display-only, never used for matching. */
function sniffKey(
  text: string,
  contentStart: number,
  contentEnd: number,
): string | undefined {
  const commaIdx = text.indexOf(",", contentStart);
  const end = commaIdx === -1 || commaIdx > contentEnd ? contentEnd : commaIdx;
  const key = text.slice(contentStart, end).trim();
  return key.length > 0 && key.length < 200 ? key : undefined;
}

function parseEntryBlock(
  text: string,
  atPos: number,
  typeName: string,
  span: BlockSpan,
): Chunk {
  const raw = text.slice(atPos, span.blockEnd);
  const commaIdx = text.indexOf(",", span.contentStart);
  const hasFields = commaIdx !== -1 && commaIdx < span.contentEnd;
  const keyEnd = hasFields ? commaIdx : span.contentEnd;
  const citationKey = text.slice(span.contentStart, keyEnd).trim();
  const fieldsStart = hasFields ? commaIdx + 1 : span.contentEnd;

  if (!citationKey) {
    return { kind: "entry", raw, parsed: { reason: "sem citation key" } as ParseFailure };
  }

  const fields = parseFields(text, fieldsStart, span.contentEnd);
  if (!fields) {
    const failure: ParseFailure & { attemptedKey?: string } = {
      reason: "não consegui interpretar os campos",
      attemptedKey: citationKey,
    };
    return { kind: "entry", raw, parsed: failure };
  }

  // BibTeX type names are case-insensitive (real templates use `@MASTERSTHESIS{...}`
  // — see fixtures); normalize known types, but keep the original casing in
  // `custom` so re-serializing an edited unknown-type entry stays close to source.
  const lower = typeName.toLowerCase();
  const entryType: EntryTypeTag = (ENTRY_TYPES as readonly string[]).includes(lower)
    ? (lower as EntryType)
    : { custom: typeName };
  const entry: BibliographyEntry = { citationKey, entryType, fields };
  return { kind: "entry", raw, parsed: entry };
}

export function parseBibFile(text: string): BibFile {
  const chunks: Chunk[] = [];
  let textStart = 0;
  let i = 0;

  const flushText = (end: number) => {
    if (end > textStart) chunks.push({ kind: "text", raw: text.slice(textStart, end) });
  };

  while (i < text.length) {
    if (text[i] !== "@") {
      i++;
      continue;
    }
    const typeMatch = text.slice(i).match(TYPE_NAME);
    const delimiterPos = i + (typeMatch?.[0].length ?? 1);
    const delimiter = text[delimiterPos];
    if (!typeMatch || (delimiter !== "{" && delimiter !== "(")) {
      // Lone '@' or unsupported shape — leave it as ordinary text.
      i++;
      continue;
    }
    const span = findBlockSpan(text, delimiterPos);
    if (!span) {
      // Unbalanced to EOF: never crash — the whole remainder is one
      // preserved failure chunk, never silently dropped or "fixed".
      flushText(i);
      chunks.push({
        kind: "entry",
        raw: text.slice(i),
        parsed: {
          reason: "chaves não balanceadas até o fim do arquivo",
          attemptedKey: sniffKey(text, delimiterPos + 1, text.length),
        } as ParseFailure,
      });
      textStart = text.length;
      i = text.length;
      break;
    }
    flushText(i);
    const typeName = typeMatch[1] ?? "";
    if (DIRECTIVE_TYPES.has(typeName.toLowerCase())) {
      chunks.push({ kind: "directive", raw: text.slice(i, span.blockEnd) });
    } else {
      chunks.push(parseEntryBlock(text, i, typeName, span));
    }
    i = span.blockEnd;
    textStart = i;
  }
  flushText(text.length);
  return { chunks };
}

export function serializeBibFile(file: BibFile): string {
  return file.chunks.map((c) => c.raw).join("");
}

function renderFieldValue(value: BibFieldValue): string {
  switch (value.kind) {
    case "braced":
      return `{${value.value}}`;
    case "quoted":
      return `"${value.value}"`;
    case "bare":
      return value.value;
  }
}

/** Renders a brand-new raw block for one entry — used by addEntry/updateEntry/renameKey. */
export function serializeEntry(entry: BibliographyEntry): string {
  const typeName = entryTypeName(entry.entryType);
  const fieldLines = [...entry.fields.entries()].map(
    ([name, value]) => `  ${name} = ${renderFieldValue(value)}`,
  );
  return [`@${typeName}{${entry.citationKey},`, fieldLines.join(",\n"), "}\n"]
    .filter((s) => s.length > 0)
    .join("\n");
}
