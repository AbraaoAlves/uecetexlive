/**
 * Gerador puro de citation key (§5.8 item 2, port do search-bib.js):
 * sobrenome + ano + palavra significativa do título, acentos removidos.
 * Sem I/O e sem tratamento de colisão — isso é responsabilidade de
 * `addEntry` (que conhece o arquivo inteiro, ver commands.ts).
 */
export interface CitationKeySource {
  readonly authorSurname?: string;
  readonly year?: string;
  readonly title?: string;
}

const STOPWORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "um",
  "uma",
  "e",
  "em",
  "para",
  "com",
  "no",
  "na",
  "the",
  "an",
  "of",
  "and",
  "is",
  "are",
  "was",
  "were",
  "to",
  "in",
  "on",
  "for",
  "all",
  "you",
]);

// Combining diacritical marks (U+0300-U+036F) left behind by NFD
// normalization — written via RegExp(str) rather than a /literal/ so the
// source file holds plain ASCII, not fragile literal combining bytes.
const COMBINING_DIACRITICS = /[\u0300-\u036f]/g;

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(COMBINING_DIACRITICS, "");
}

function firstSignificantWord(title: string): string {
  const words =
    stripAccents(title)
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? [];
  return words.find((w) => !STOPWORDS.has(w)) ?? words[0] ?? "";
}

export function buildCitationKey({
  authorSurname,
  year,
  title,
}: CitationKeySource): string {
  const surname = authorSurname
    ? stripAccents(authorSurname)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
    : "";
  const titleWord = title ? firstSignificantWord(title) : "";
  const key = `${surname}${year ?? ""}${titleWord}`;
  return key || "referencia";
}
