import type { ReferenceCandidate, SearchResult } from "@papyru/bibliography";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceSearch } from "./ReferenceSearch";

const { searchReferencesMock } = vi.hoisted(() => ({ searchReferencesMock: vi.fn() }));
vi.mock("@papyru/bibliography", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@papyru/bibliography")>()),
  searchReferences: searchReferencesMock,
}));

const candidate: ReferenceCandidate = {
  source: "crossref",
  doi: "10.1234/attention",
  title: "Attention Is All You Need",
  authors: [{ firstName: "Ashish", lastName: "Vaswani" }],
  year: "2017",
  venue: "NeurIPS",
  entryType: "article",
  url: "https://doi.org/10.1234/attention",
};

function resultOf(
  candidates: ReferenceCandidate[],
  failures: SearchResult["failures"] = [],
) {
  return { candidates, failures };
}

describe("ReferenceSearch", () => {
  afterEach(cleanup);
  beforeEach(() => searchReferencesMock.mockReset());

  it("searches on Enter and renders a result card", async () => {
    searchReferencesMock.mockResolvedValue(resultOf([candidate]));
    render(
      <ReferenceSearch
        existingDois={new Set()}
        onAdd={vi.fn()}
        onAddManually={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("reference-search-input"), {
      target: { value: "attention is all you need" },
    });
    fireEvent.keyDown(screen.getByTestId("reference-search-input"), { key: "Enter" });

    await screen.findByTestId("reference-search-result");
    expect(screen.getByText("Attention Is All You Need")).toBeTruthy();
    expect(searchReferencesMock).toHaveBeenCalledWith("attention is all you need");
  });

  it("calls onAdd once and disables the button for an already-added DOI", async () => {
    searchReferencesMock.mockResolvedValue(resultOf([candidate]));
    const onAdd = vi.fn();
    render(
      <ReferenceSearch
        existingDois={new Set(["10.1234/attention"])}
        onAdd={onAdd}
        onAddManually={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("reference-search-input"), {
      target: { value: "attention" },
    });
    fireEvent.click(screen.getByTestId("reference-search-submit"));

    await screen.findByTestId("reference-search-result");
    const addButton = screen.getByTestId("reference-search-add") as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
    expect(screen.getByText("Já está nas suas referências ✓")).toBeTruthy();
    fireEvent.click(addButton);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("marks a freshly-added result as added without a second onAdd call", async () => {
    searchReferencesMock.mockResolvedValue(resultOf([candidate]));
    const onAdd = vi.fn();
    render(
      <ReferenceSearch existingDois={new Set()} onAdd={onAdd} onAddManually={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("reference-search-input"), {
      target: { value: "attention" },
    });
    fireEvent.click(screen.getByTestId("reference-search-submit"));
    await screen.findByTestId("reference-search-result");

    fireEvent.click(screen.getByTestId("reference-search-add"));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(candidate);
    expect(screen.getByText("Já está nas suas referências ✓")).toBeTruthy();
  });

  it("shows the empty state with a manual-add fallback carrying the query", async () => {
    searchReferencesMock.mockResolvedValue(resultOf([]));
    const onAddManually = vi.fn();
    render(
      <ReferenceSearch
        existingDois={new Set()}
        onAdd={vi.fn()}
        onAddManually={onAddManually}
      />,
    );
    fireEvent.change(screen.getByTestId("reference-search-input"), {
      target: { value: "um livro raríssimo" },
    });
    fireEvent.click(screen.getByTestId("reference-search-submit"));

    await screen.findByTestId("reference-search-empty");
    fireEvent.click(screen.getByText("adicionar manualmente"));
    expect(onAddManually).toHaveBeenCalledWith("um livro raríssimo");
  });

  it("shows a rate-limit message and disables the button when a provider 429s", async () => {
    searchReferencesMock.mockResolvedValue(
      resultOf([], [{ source: "crossref", reason: "CrossRef: HTTP 429" }]),
    );
    render(
      <ReferenceSearch
        existingDois={new Set()}
        onAdd={vi.fn()}
        onAddManually={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("reference-search-input"), {
      target: { value: "query" },
    });
    fireEvent.click(screen.getByTestId("reference-search-submit"));

    await screen.findByTestId("reference-search-rate-limit");
    expect(
      (screen.getByTestId("reference-search-submit") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("never calls searchReferences for a blank query", () => {
    render(
      <ReferenceSearch
        existingDois={new Set()}
        onAdd={vi.fn()}
        onAddManually={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("reference-search-submit"));
    expect(searchReferencesMock).not.toHaveBeenCalled();
  });
});
