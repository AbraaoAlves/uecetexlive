/**
 * Orquestração da busca (port de search-bib.js): dois
 * providers via Promise.allSettled (um caindo não derruba a busca),
 * timeout de 8s por AbortController, dedupe por DOI entre providers,
 * CrossRef primeiro no ranking (comportamento do gist original).
 */
import { searchCrossRef } from "./providers/crossref";
import { searchSemanticScholar } from "./providers/semantic-scholar";
import type { ProviderFailure, ReferenceCandidate, SearchResult } from "./types";

const TIMEOUT_MS = 8000;

export interface SearchOptions {
  /** CrossRef "polite pool" contact — env-driven in production. */
  mailto?: string;
  timeoutMs?: number;
}

function dedupeByDoi(candidates: ReferenceCandidate[]): ReferenceCandidate[] {
  const seen = new Set<string>();
  const result: ReferenceCandidate[] = [];
  for (const c of candidates) {
    const key = c.doi?.toLowerCase();
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    result.push(c);
  }
  return result;
}

export async function searchReferences(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { candidates: [], failures: [] };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);

  try {
    const [crossref, semanticScholar] = await Promise.allSettled([
      searchCrossRef(trimmed, controller.signal, { mailto: options.mailto }),
      searchSemanticScholar(trimmed, controller.signal),
    ]);

    const candidates: ReferenceCandidate[] = [];
    const failures: ProviderFailure[] = [];

    // CrossRef first — matches the gist's ranking (no relevance scoring, just provider order).
    if (crossref.status === "fulfilled") candidates.push(...crossref.value);
    else failures.push({ source: "crossref", reason: describeError(crossref.reason) });

    if (semanticScholar.status === "fulfilled") candidates.push(...semanticScholar.value);
    else
      failures.push({
        source: "semantic-scholar",
        reason: describeError(semanticScholar.reason),
      });

    return { candidates: dedupeByDoi(candidates), failures };
  } finally {
    clearTimeout(timeout);
  }
}

function describeError(reason: unknown): string {
  if (reason instanceof DOMException && reason.name === "AbortError") return "timeout";
  if (reason instanceof Error) return reason.message;
  return "erro desconhecido";
}
