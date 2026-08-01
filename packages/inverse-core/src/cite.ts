/**
 * Citações autor-data (NBR 10520:2023) → comandos abntex2cite.
 *
 * O que chega do PDF é texto: "(Sousa; Favero, 2015)". Este módulo reconhece
 * esse texto e o liga às entradas reconstruídas da bibliografia, produzindo
 * `\cite`/`\citeonline` com as MESMAS chaves que o `.bib` emitido usa.
 *
 * Regra de ouro: na dúvida, deixar literal. Uma chave inventada quebra a
 * compilação e mente sobre a bibliografia; um parêntese literal só perde o
 * hyperlink. Por isso um parêntese só é convertido quando TODAS as obras
 * dentro dele resolveram.
 */
import { bibKeys } from "./bibkey.js";
import type { BibEntry } from "./semantic.js";

export type Segment =
  | { kind: "text"; value: string }
  /** (Autor, ano[, p. N]) — uma ou mais obras. */
  | { kind: "cite"; keys: string[]; suffix?: string }
  /** Autor (ano) — o nome faz parte da frase. */
  | { kind: "citeonline"; key: string };

export interface CiteIndex {
  /** `sobrenome-normalizado:ano` → chaves, na ordem da bibliografia. */
  readonly byAuthorYear: ReadonlyMap<string, readonly string[]>;
}

/** Derruba diacríticos, caixa, hífens, espaços e pontos. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const YEAR = /\b(1[89]\d\d|20\d\d)\b/;

/**
 * Índice das entradas. As chaves vêm de `bibKeys` — nunca recalculadas aqui,
 * é o que garante paridade com o `.bib` emitido. A ordem da lista é a ordem
 * da bibliografia, que é também a ordem dos sufixos `a`, `b`, … do estilo.
 */
export function buildCiteIndex(entries: BibEntry[]): CiteIndex {
  const keys = bibKeys(entries);
  const byAuthorYear = new Map<string, string[]>();
  entries.forEach((e, i) => {
    const surname = /^([^,]+)/.exec(e.raw)?.[1];
    const year = YEAR.exec(e.raw)?.[1];
    const key = keys[i];
    if (!surname || !year || !key) return;
    const bucket = byAuthorYear.get(`${norm(surname)}:${year}`);
    if (bucket) bucket.push(key);
    else byAuthorYear.set(`${norm(surname)}:${year}`, [key]);
  });
  return { byAuthorYear };
}

interface Work {
  authors: string[];
  year: string;
  suffix: string | null;
  page: string | null;
}

/** Uma obra fechada: "…, 2015", "…, 2009a", "…, 2020, p. 15". */
const WORK_END =
  /^(.*?),\s*((?:1[89]|20)\d\d)([a-z])?(?:\s*,\s*p\.\s*(\d+(?:[-–]\d+)?))?$/;

/**
 * Divide o conteúdo de um parêntese em obras. `null` quando não é citação —
 * sobrou nome sem ano, ou não há obra nenhuma.
 *
 * O `;` separa tanto autores quanto obras; é a obra fechada (a que termina em
 * ano) que delimita, e os nomes acumulados antes dela pertencem a ela.
 */
function parseWorks(inner: string): Work[] | null {
  const works: Work[] = [];
  let authors: string[] = [];
  for (const part of inner.split(";").map((p) => p.trim())) {
    const m = WORK_END.exec(part);
    if (!m) {
      authors.push(part);
      continue;
    }
    works.push({
      authors: [...authors, (m[1] ?? "").trim()],
      year: m[2] as string,
      suffix: m[3] ?? null,
      page: m[4] ?? null,
    });
    authors = [];
  }
  if (authors.length > 0 || works.length === 0) return null;
  return works;
}

/** Primeiro sobrenome da obra — "et al." nunca é a primeira palavra. */
function headOf(work: Work): string {
  return (work.authors[0] ?? "").split(/\s+/)[0] ?? "";
}

/** Chave da obra, ou `null` quando não resolve sem ambiguidade. */
function resolveWork(work: Work, index: CiteIndex): string | null {
  const hits = index.byAuthorYear.get(`${norm(headOf(work))}:${work.year}`);
  if (!hits || hits.length === 0) return null;
  if (work.suffix) return hits[work.suffix.charCodeAt(0) - 97] ?? null;
  return hits.length === 1 ? (hits[0] as string) : null;
}

/** Segmento de citação do parêntese inteiro, ou `null` para deixar literal. */
function citeSegment(inner: string, index: CiteIndex): Segment | null {
  const works = parseWorks(inner);
  if (!works) return null;
  const keys: string[] = [];
  for (const work of works) {
    const key = resolveWork(work, index);
    if (!key) return null;
    keys.push(key);
  }
  const page = works.length === 1 ? works[0]?.page : null;
  return page ? { kind: "cite", keys, suffix: `p.~${page}` } : { kind: "cite", keys };
}

const PARENTHETICAL = /\(([^()]{2,400}?)\)/g;

/**
 * Narrativa: "Sobrenome (ano)", "Sobrenome et al. (ano)", "A e B (ano)".
 * Conservador de propósito — só vira comando se o nome estiver no índice, o
 * que descarta sozinho os "a Universidade (UECE)" da vida.
 */
const NARRATIVE =
  /(?<![\p{L}\p{M}])(\p{Lu}[\p{L}\p{M}'-]+)(?:\s+et\s+al\.?|\s+e\s+\p{Lu}[\p{L}\p{M}'-]+)?\s+\((\d{4})([a-z])?\)/gu;

/** Converte as narrativas resolvíveis de um trecho ainda literal. */
function pushNarrative(out: Segment[], text: string, index: CiteIndex): void {
  let cursor = 0;
  NARRATIVE.lastIndex = 0;
  for (let m = NARRATIVE.exec(text); m !== null; m = NARRATIVE.exec(text)) {
    const key = resolveWork(
      { authors: [m[1] ?? ""], year: m[2] as string, suffix: m[3] ?? null, page: null },
      index,
    );
    if (!key) continue;
    if (m.index > cursor) out.push({ kind: "text", value: text.slice(cursor, m.index) });
    out.push({ kind: "citeonline", key });
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) out.push({ kind: "text", value: text.slice(cursor) });
}

/** Particiona `text` em trechos literais e citações resolvidas. */
export function segmentCitations(text: string, index: CiteIndex): Segment[] {
  const out: Segment[] = [];
  let cursor = 0;
  PARENTHETICAL.lastIndex = 0;
  for (let m = PARENTHETICAL.exec(text); m !== null; m = PARENTHETICAL.exec(text)) {
    const segment = citeSegment(m[1] as string, index);
    if (!segment) continue;
    pushNarrative(out, text.slice(cursor, m.index), index);
    out.push(segment);
    cursor = m.index + m[0].length;
  }
  pushNarrative(out, text.slice(cursor), index);
  return out;
}

/**
 * Quantas citações-candidatas ficaram literais — o número que o relatório de
 * importação mostra ao autor. Conta o parêntese com forma de citação que não
 * resolveu e a narrativa cujo nome não está na bibliografia.
 */
export function countUnresolved(text: string, index: CiteIndex): number {
  let unresolved = 0;
  PARENTHETICAL.lastIndex = 0;
  for (let m = PARENTHETICAL.exec(text); m !== null; m = PARENTHETICAL.exec(text)) {
    const works = parseWorks(m[1] as string);
    if (works && !citeSegment(m[1] as string, index)) unresolved++;
  }
  for (const segment of segmentCitations(text, index)) {
    if (segment.kind !== "text") continue;
    NARRATIVE.lastIndex = 0;
    while (NARRATIVE.exec(segment.value) !== null) unresolved++;
  }
  return unresolved;
}
