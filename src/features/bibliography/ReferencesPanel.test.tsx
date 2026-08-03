import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReferencesPanel } from "./ReferencesPanel";

// No `globals: true` in vite.config.ts's test config, so @testing-library/react's
// own auto-cleanup (which relies on a global `afterEach`) never runs — without
// this, each render() in the file piles onto the same document.
afterEach(cleanup);

const SAMPLE = `@book{freire1970,
  author = {Freire, Paulo},
  title = {Pedagogia do Oprimido},
  publisher = {Paz e Terra},
  year = {1970}
}

@article{lamport1986,
  author = {Lamport, Leslie},
  title = {LaTeX: User's Guide},
  journal = {Addison-Wesley},
  year = {1986}
}
`;

const WITH_FAILURE = `${SAMPLE}
@article{broken, title = {unterminated
`;

const WITH_INCOMPLETE = `${SAMPLE}
@book{incomplete1980,
  author = {Autor, Sem},
  title = {Um Livro Sem Editora},
  year = {1980}
}
`;

const MIXED_COMPLETENESS = `@book{completeFirst,
  author = {Zulu, Ana},
  title = {Completa primeiro},
  publisher = {Editora A},
  year = {2000}
}

@book{incompleteOld,
  author = {Bravo, Bia},
  title = {Incompleta antiga},
  year = {1900}
}

@book{incompleteNew,
  author = {Alpha, Alice},
  title = {Incompleta nova},
  year = {2100}
}

@book{completeLast,
  author = {Echo, Eva},
  title = {Completa por último},
  publisher = {Editora B},
  year = {1800}
}
`;

function renderedReferenceKeys(): string[] {
  return Array.from(screen.getByTestId("references-list").children)
    .map((element) => element.getAttribute("data-testid") ?? "")
    .filter((testId) => testId.startsWith("reference-"))
    .map((testId) => testId.replace("reference-", ""));
}

describe("ReferencesPanel", () => {
  it("lists every entry from the .bib fixture", () => {
    render(<ReferencesPanel bibText={SAMPLE} />);
    expect(screen.getByTestId("reference-freire1970")).toBeTruthy();
    expect(screen.getByTestId("reference-lamport1986")).toBeTruthy();
    expect(screen.getByText("Pedagogia do Oprimido")).toBeTruthy();
    expect(screen.getByText("Freire, P.")).toBeTruthy();
    expect(screen.getByText("Livro")).toBeTruthy();
  });

  it("shows a failure card for a malformed entry without dropping the others", () => {
    render(<ReferencesPanel bibText={WITH_FAILURE} />);
    expect(screen.getByTestId("reference-freire1970")).toBeTruthy();
    expect(screen.getByTestId("reference-lamport1986")).toBeTruthy();
    expect(screen.getByTestId("reference-parse-failure")).toBeTruthy();
    expect(screen.getByText("Não consegui ler esta referência")).toBeTruthy();
  });

  it("shows an empty state when no .bib file was discovered", () => {
    render(<ReferencesPanel bibText={null} />);
    expect(screen.getByTestId("references-empty")).toBeTruthy();
  });

  // O "ver código" saiu do painel: quem quer o BibTeX cru usa o botão
  // "Fonte BibTeX" da barra do editor, que abre o CodeMirror editável — dois
  // modos-fonte, um deles só de leitura, era um a mais.
  it("não tem mais um segundo modo-fonte por dentro", () => {
    render(<ReferencesPanel bibText={SAMPLE} />);
    expect(screen.queryByTestId("references-toggle-code")).toBeNull();
    expect(screen.queryByTestId("references-raw")).toBeNull();
  });

  it("hides edit/remove actions when onWriteBib is not provided (read-only)", () => {
    render(<ReferencesPanel bibText={SAMPLE} />);
    expect(screen.queryByTestId("reference-edit-freire1970")).toBeNull();
    expect(screen.queryByTestId("reference-remove-freire1970")).toBeNull();
  });

  it("edits a field through the dialog and writes only that entry's chunk", () => {
    const onWriteBib = vi.fn();
    render(<ReferencesPanel bibText={SAMPLE} onWriteBib={onWriteBib} />);
    fireEvent.click(screen.getByTestId("reference-edit-freire1970"));

    const yearInput = screen.getByTestId("reference-field-year") as HTMLInputElement;
    expect(yearInput.value).toBe("1970");
    fireEvent.change(yearInput, { target: { value: "1968" } });
    fireEvent.click(screen.getByTestId("add-reference-submit"));

    expect(onWriteBib).toHaveBeenCalledTimes(1);
    const next = onWriteBib.mock.calls[0]?.[0] as string;
    expect(next).toContain("year = {1968}");
    expect(next).not.toContain("year = {1970}");
    // The other entry's bytes are untouched.
    expect(next).toContain("title = {LaTeX: User's Guide}");
  });

  it("removes an entry after confirming, with no usage warning when unused", () => {
    const onWriteBib = vi.fn();
    render(<ReferencesPanel bibText={SAMPLE} onWriteBib={onWriteBib} />);
    fireEvent.click(screen.getByTestId("reference-remove-freire1970"));

    expect(screen.queryByTestId("remove-usage-warning")).toBeNull();
    fireEvent.click(screen.getByTestId("remove-reference-confirm"));

    expect(onWriteBib).toHaveBeenCalledTimes(1);
    const next = onWriteBib.mock.calls[0]?.[0] as string;
    expect(next).not.toContain("freire1970");
    expect(next).toContain("lamport1986");
  });

  it("warns how many times the key is cited before removing", () => {
    const onWriteBib = vi.fn();
    const texSources = {
      "introducao.tex": "Como diz \\citeonline{freire1970}, ...",
      "conclusao.tex": "Retomando \\citeonline{freire1970} de novo.",
    };
    render(
      <ReferencesPanel
        bibText={SAMPLE}
        onWriteBib={onWriteBib}
        texSources={texSources}
      />,
    );
    fireEvent.click(screen.getByTestId("reference-remove-freire1970"));
    expect(screen.getByTestId("remove-usage-warning").textContent).toContain("2 vezes");

    fireEvent.click(screen.getByTestId("remove-reference-cancel"));
    expect(onWriteBib).not.toHaveBeenCalled();
    expect(screen.getByTestId("reference-freire1970")).toBeTruthy();
  });

  it("flags a book missing its publisher and offers 'completar'", () => {
    const onWriteBib = vi.fn();
    render(<ReferencesPanel bibText={WITH_INCOMPLETE} onWriteBib={onWriteBib} />);
    const badge = screen.getByTestId("reference-incomplete-incomplete1980");
    expect(badge.textContent).toContain("Editora");
    expect(screen.getByTestId("references-incomplete-aggregate").textContent).toContain(
      "1 referência incompleta",
    );

    // "completar" opens the edit dialog for that exact entry.
    const completar = badge.querySelector("button") as HTMLButtonElement;
    fireEvent.click(completar);
    expect((screen.getByTestId("reference-field-title") as HTMLInputElement).value).toBe(
      "Um Livro Sem Editora",
    );
  });

  it("shows no incomplete badge/aggregate when every entry has its required fields", () => {
    render(<ReferencesPanel bibText={SAMPLE} />);
    expect(screen.queryByTestId("references-incomplete-aggregate")).toBeNull();
    expect(screen.queryByTestId("reference-incomplete-freire1970")).toBeNull();
  });

  it("keeps incomplete entries first without changing the chosen sort within groups", () => {
    render(<ReferencesPanel bibText={MIXED_COMPLETENESS} />);

    expect(renderedReferenceKeys()).toEqual([
      "incompleteOld",
      "incompleteNew",
      "completeFirst",
      "completeLast",
    ]);
    expect(screen.getByTestId("references-group-incomplete").textContent).toBe(
      "Faltam dados nestas",
    );
    expect(screen.getByTestId("references-group-complete").textContent).toBe("Completas");

    fireEvent.click(screen.getByTestId("references-sort-author"));
    expect(renderedReferenceKeys()).toEqual([
      "incompleteNew",
      "incompleteOld",
      "completeLast",
      "completeFirst",
    ]);

    fireEvent.click(screen.getByTestId("references-sort-year"));
    expect(renderedReferenceKeys()).toEqual([
      "incompleteOld",
      "incompleteNew",
      "completeLast",
      "completeFirst",
    ]);
  });

  it("replaces the live status when the same reference is requested again", () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const { rerender } = render(
      <ReferencesPanel
        bibText={SAMPLE}
        onWriteBib={vi.fn()}
        focusKey="freire1970"
        focusNonce={1}
      />,
    );
    const firstStatus = screen.getByTestId("references-focus-status");

    rerender(
      <ReferencesPanel
        bibText={SAMPLE}
        onWriteBib={vi.fn()}
        focusKey="freire1970"
        focusNonce={2}
      />,
    );

    const secondStatus = screen.getByTestId("references-focus-status");
    expect(secondStatus.textContent).toContain("freire1970");
    expect(secondStatus).not.toBe(firstStatus);
  });
});
