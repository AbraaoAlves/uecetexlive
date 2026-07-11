import type { ReferenceCandidate } from "../types";

const CROSSREF_TYPE_MAP: Record<string, ReferenceCandidate["entryType"]> = {
  "journal-article": "article",
  "proceedings-article": "inproceedings",
  book: "book",
  monograph: "book",
  "book-chapter": "incollection",
  "reference-entry": "incollection",
  report: "techreport",
  "posted-content": "unpublished",
  dissertation: "phdthesis",
};

interface CrossRefAuthor {
  given?: string;
  family?: string;
}

interface CrossRefItem {
  DOI?: string;
  title?: string[];
  author?: CrossRefAuthor[];
  "container-title"?: string[];
  type?: string;
  URL?: string;
  published?: { "date-parts"?: number[][] };
  "published-print"?: { "date-parts"?: number[][] };
}

function extractYear(item: CrossRefItem): string | null {
  const parts =
    item.published?.["date-parts"]?.[0] ?? item["published-print"]?.["date-parts"]?.[0];
  const year = parts?.[0];
  return year ? String(year) : null;
}

/** `mailto` for the "polite pool" — env-driven, wired to production later (§5.8 backlog item 6). */
export interface CrossRefOptions {
  mailto?: string;
}

export async function searchCrossRef(
  query: string,
  signal: AbortSignal,
  options: CrossRefOptions = {},
): Promise<ReferenceCandidate[]> {
  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query", query);
  url.searchParams.set("rows", "10");
  if (options.mailto) url.searchParams.set("mailto", options.mailto);

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`CrossRef: HTTP ${res.status}`);
  const data = (await res.json()) as { message?: { items?: CrossRefItem[] } };
  const items = data.message?.items ?? [];

  return items
    .filter((item) => item.title?.[0])
    .map((item) => ({
      source: "crossref" as const,
      doi: item.DOI ?? null,
      title: item.title?.[0] ?? "",
      authors: (item.author ?? [])
        .filter((a) => a.family)
        .map((a) => ({ firstName: a.given ?? "", lastName: a.family ?? "" })),
      year: extractYear(item),
      venue: item["container-title"]?.[0] ?? null,
      entryType: CROSSREF_TYPE_MAP[item.type ?? ""] ?? "misc",
      url: item.URL ?? (item.DOI ? `https://doi.org/${item.DOI}` : null),
    }));
}
