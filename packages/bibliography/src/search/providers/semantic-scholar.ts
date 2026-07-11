import type { ReferenceCandidate } from "../types";

interface S2Author {
  name?: string;
}

interface S2Paper {
  title?: string;
  authors?: S2Author[];
  year?: number;
  venue?: string;
  externalIds?: { DOI?: string };
  url?: string;
}

/** S2 gives one combined "name" per author; splitting on the last space is the gist's own heuristic. */
function splitAuthorName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) return { firstName: "", lastName: trimmed };
  return {
    firstName: trimmed.slice(0, lastSpace),
    lastName: trimmed.slice(lastSpace + 1),
  };
}

export async function searchSemanticScholar(
  query: string,
  signal: AbortSignal,
): Promise<ReferenceCandidate[]> {
  const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
  url.searchParams.set("query", query);
  url.searchParams.set("limit", "10");
  url.searchParams.set("fields", "title,authors,year,venue,externalIds,url");

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Semantic Scholar: HTTP ${res.status}`);
  const data = (await res.json()) as { data?: S2Paper[] };
  const items = data.data ?? [];

  return items
    .filter((item) => item.title)
    .map((item) => ({
      source: "semantic-scholar" as const,
      doi: item.externalIds?.DOI ?? null,
      title: item.title ?? "",
      authors: (item.authors ?? [])
        .filter((a) => a.name)
        .map((a) => splitAuthorName(a.name ?? "")),
      year: item.year ? String(item.year) : null,
      venue: item.venue || null,
      entryType: "article" as const,
      url:
        item.url ??
        (item.externalIds?.DOI ? `https://doi.org/${item.externalIds.DOI}` : null),
    }));
}
