/**
 * Busca + adição em 1 clique. Submissão explícita (Enter/botão), nunca
 * busca-enquanto-digita — os catálogos públicos não toleram volume de
 * teclado.
 */
import type { ReferenceCandidate, SearchResult } from "@papyru/bibliography";
import { searchReferences } from "@papyru/bibliography";
import { useEffect, useState } from "react";
import { strings } from "@/lib/strings";
import { EntryTypeIcon } from "./entry-type-icon";

export interface ReferenceSearchProps {
  /** Lowercased DOIs already in the project's .bib, for the dedupe check. */
  existingDois: ReadonlySet<string>;
  onAdd: (candidate: ReferenceCandidate) => void;
  onAddManually: (initialTitle: string) => void;
  /** Pre-fills and auto-runs the search once (B5c — "Citation undefined" hands the missing key here). */
  initialQuery?: string;
  onInitialQueryConsumed?: () => void;
}

type Status = "idle" | "loading" | "done";
const RATE_LIMIT_COOLDOWN_MS = 10_000;

export function ReferenceSearch({
  existingDois,
  onAdd,
  onAddManually,
  initialQuery,
  onInitialQueryConsumed,
}: ReferenceSearchProps) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [addedDois, setAddedDois] = useState<ReadonlySet<string>>(new Set());
  const [rateLimitedUntil, setRateLimitedUntil] = useState(0);

  const rateLimited = Date.now() < rateLimitedUntil;

  useEffect(() => {
    if (!rateLimitedUntil) return;
    const timeout = setTimeout(
      () => setRateLimitedUntil(0),
      rateLimitedUntil - Date.now(),
    );
    return () => clearTimeout(timeout);
  }, [rateLimitedUntil]);

  const run = async (explicitQuery?: string) => {
    const trimmed = (explicitQuery ?? query).trim();
    if (!trimmed || rateLimited) return;
    setStatus("loading");
    try {
      const searchResult = await searchReferences(trimmed);
      setResult(searchResult);
      if (searchResult.failures.some((f) => f.reason.includes("429"))) {
        setRateLimitedUntil(Date.now() + RATE_LIMIT_COOLDOWN_MS);
      }
    } catch {
      setResult({
        candidates: [],
        failures: [
          { source: "crossref", reason: "erro desconhecido" },
          { source: "semantic-scholar", reason: "erro desconhecido" },
        ],
      });
    } finally {
      setStatus("done");
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per fresh initialQuery, not on every render — run/onInitialQueryConsumed identity isn't the trigger.
  useEffect(() => {
    if (!initialQuery) return;
    setQuery(initialQuery);
    void run(initialQuery);
    onInitialQueryConsumed?.();
  }, [initialQuery]);

  const handleAdd = (candidate: ReferenceCandidate) => {
    onAdd(candidate);
    if (candidate.doi)
      setAddedDois((prev) => new Set(prev).add(candidate.doi?.toLowerCase() ?? ""));
  };

  const isAdded = (candidate: ReferenceCandidate) =>
    !!candidate.doi &&
    (existingDois.has(candidate.doi.toLowerCase()) ||
      addedDois.has(candidate.doi.toLowerCase()));

  const isRateLimited =
    rateLimited || (result?.failures.some((f) => f.reason.includes("429")) ?? false);
  const allProvidersFailed =
    (result?.failures.length ?? 0) >= 2 && result?.candidates.length === 0;
  const isNetworkDown = allProvidersFailed && !isRateLimited;
  const isPartialFailure =
    (result?.failures.length ?? 0) > 0 && !isRateLimited && !isNetworkDown;

  return (
    <div className="flex flex-col">
      <div className="flex gap-1.5 p-2">
        <input
          type="text"
          data-testid="reference-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder={strings.references.searchPlaceholder}
          className="min-w-0 flex-1 rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          data-testid="reference-search-submit"
          disabled={!query.trim() || rateLimited}
          onClick={() => void run()}
          className="rounded-md bg-accent px-3 py-1.5 text-accent-foreground text-sm hover:bg-accent-strong disabled:opacity-40"
        >
          {strings.references.searchButton}
        </button>
      </div>
      <p className="px-2 pb-2 text-ink-subtle text-xs">
        {strings.references.privacyNotice}
      </p>

      {status === "loading" && (
        <div className="space-y-2 px-2" data-testid="reference-search-loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-surface" />
          ))}
        </div>
      )}

      {status === "done" && result && (
        <div data-testid="reference-search-results">
          {isRateLimited && (
            <p
              className="px-2 pb-2 text-danger text-xs"
              data-testid="reference-search-rate-limit"
            >
              {strings.references.searchErrorRateLimit}
            </p>
          )}
          {isNetworkDown && (
            <p
              className="px-2 pb-2 text-danger text-xs"
              data-testid="reference-search-offline"
            >
              {strings.references.searchErrorNetwork}
            </p>
          )}
          {isPartialFailure && (
            <p className="px-2 pb-2 text-warning text-xs">
              {strings.references.searchPartialFailure}
            </p>
          )}
          {result.candidates.length === 0 && !isRateLimited && !isNetworkDown ? (
            <p
              className="px-2 pb-2 text-ink-muted text-sm"
              data-testid="reference-search-empty"
            >
              {strings.references.searchEmpty}{" "}
              <button
                type="button"
                className="text-accent underline hover:no-underline"
                onClick={() => onAddManually(query.trim())}
              >
                {strings.references.searchEmptyManual}
              </button>
            </p>
          ) : (
            <ul>
              {result.candidates.map((candidate) => (
                <SearchResultRow
                  key={`${candidate.source}-${candidate.doi ?? candidate.title}`}
                  candidate={candidate}
                  added={isAdded(candidate)}
                  onAdd={() => handleAdd(candidate)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SearchResultRow({
  candidate,
  added,
  onAdd,
}: {
  candidate: ReferenceCandidate;
  added: boolean;
  onAdd: () => void;
}) {
  return (
    <li className="border-b px-2 py-2 text-sm" data-testid="reference-search-result">
      <div className="flex items-center gap-1.5 text-ink-muted text-xs">
        <EntryTypeIcon type={candidate.entryType} />
        {candidate.venue && <span>{candidate.venue}</span>}
      </div>
      <div className="font-medium">{candidate.title}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-ink-muted text-xs">
          {candidate.authors
            .slice(0, 3)
            .map((a) => a.lastName)
            .join(", ") || strings.references.unknownAuthor}{" "}
          · {candidate.year ?? strings.references.unknownYear}
        </span>
        <button
          type="button"
          disabled={added}
          data-testid="reference-search-add"
          onClick={onAdd}
          className="shrink-0 rounded px-2 py-1 text-accent text-xs hover:bg-accent-soft disabled:cursor-default disabled:text-success disabled:hover:bg-transparent"
        >
          {added
            ? strings.references.searchResultAdded
            : strings.references.searchResultAdd}
        </button>
      </div>
    </li>
  );
}
