import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchReferences } from "../reference-search";

const CROSSREF_OK = {
  message: {
    items: [
      {
        DOI: "10.1234/lamport",
        title: ["LaTeX: A Document Preparation System"],
        author: [{ given: "Leslie", family: "Lamport" }],
        type: "journal-article",
        "container-title": ["Addison-Wesley"],
        published: { "date-parts": [[1986]] },
        URL: "https://example.org/lamport",
      },
      {
        // No author, no DOI — CrossRef really does omit these sometimes.
        title: ["Untitled Proceedings Entry"],
        type: "proceedings-article",
        published: { "date-parts": [[2010]] },
      },
    ],
  },
};

const S2_OK = {
  data: [
    {
      title: "Attention Is All You Need",
      authors: [{ name: "Ashish Vaswani" }, { name: "Noam Shazeer" }],
      year: 2017,
      venue: "NeurIPS",
      externalIds: { DOI: "10.5555/attention" },
      url: "https://example.org/attention",
    },
  ],
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function mockFetch(byHost: Record<string, () => Promise<Response> | Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const handler = Object.entries(byHost).find(([host]) => url.includes(host))?.[1];
      if (!handler) throw new Error(`unexpected fetch: ${url}`);
      const signal = init?.signal;
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      // Real fetch rejects a still-pending request once its signal aborts —
      // mirror that so the orchestrator's timeout path is actually exercised.
      return new Promise<Response>((resolve, reject) => {
        signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
        Promise.resolve(handler()).then(resolve, reject);
      });
    }),
  );
}

describe("searchReferences", () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.unstubAllGlobals());

  it("merges both providers, CrossRef first, and survives a missing-author entry", async () => {
    mockFetch({
      "api.crossref.org": () => jsonResponse(CROSSREF_OK),
      "api.semanticscholar.org": () => jsonResponse(S2_OK),
    });
    const result = await searchReferences("lamport latex");
    expect(result.failures).toHaveLength(0);
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates[0]?.source).toBe("crossref");
    expect(result.candidates[1]?.authors).toEqual([]);
  });

  it("returns partial results when one provider 500s", async () => {
    mockFetch({
      "api.crossref.org": () => jsonResponse(CROSSREF_OK),
      "api.semanticscholar.org": () => new Response("", { status: 500 }),
    });
    const result = await searchReferences("lamport latex");
    expect(result.candidates).toHaveLength(2);
    expect(result.failures).toEqual([
      { source: "semantic-scholar", reason: "Semantic Scholar: HTTP 500" },
    ]);
  });

  it("surfaces a 429 as a provider failure, not a thrown exception", async () => {
    mockFetch({
      "api.crossref.org": () => new Response("", { status: 429 }),
      "api.semanticscholar.org": () => jsonResponse(S2_OK),
    });
    const result = await searchReferences("query");
    expect(result.failures[0]).toEqual({
      source: "crossref",
      reason: "CrossRef: HTTP 429",
    });
    expect(result.candidates).toHaveLength(1);
  });

  it("dedupes candidates sharing the same DOI across providers", async () => {
    const sameDoi = {
      message: {
        items: [
          {
            DOI: "10.5555/attention",
            title: ["Attention Is All You Need (CrossRef copy)"],
            type: "journal-article",
          },
        ],
      },
    };
    mockFetch({
      "api.crossref.org": () => jsonResponse(sameDoi),
      "api.semanticscholar.org": () => jsonResponse(S2_OK),
    });
    const result = await searchReferences("attention");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.source).toBe("crossref"); // first-seen wins
  });

  it("times out and reports both providers as failed", async () => {
    mockFetch({
      "api.crossref.org": () => new Promise(() => {}), // never resolves
      "api.semanticscholar.org": () => new Promise(() => {}),
    });
    const result = await searchReferences("slow query", { timeoutMs: 20 });
    expect(result.candidates).toHaveLength(0);
    expect(result.failures).toHaveLength(2);
    expect(result.failures.every((f) => f.reason === "timeout")).toBe(true);
  });

  it("returns empty immediately for a blank query, without calling fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await searchReferences("   ");
    expect(result).toEqual({ candidates: [], failures: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
