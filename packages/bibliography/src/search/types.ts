import type { EntryType } from "../domain/types";

export type ProviderId = "crossref" | "semantic-scholar";

export interface CandidateAuthor {
  readonly firstName: string;
  readonly lastName: string;
}

/**
 * Normalized shape both providers map into (port of search-bib.js).
 * `doi` drives dedup across providers.
 */
export interface ReferenceCandidate {
  readonly source: ProviderId;
  readonly doi: string | null;
  readonly title: string;
  readonly authors: readonly CandidateAuthor[];
  readonly year: string | null;
  /** journal / booktitle, depending on entryType. */
  readonly venue: string | null;
  readonly entryType: EntryType;
  readonly url: string | null;
}

export interface ProviderFailure {
  readonly source: ProviderId;
  readonly reason: string;
}

export interface SearchResult {
  readonly candidates: readonly ReferenceCandidate[];
  readonly failures: readonly ProviderFailure[];
}
