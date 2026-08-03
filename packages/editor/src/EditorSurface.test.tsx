/**
 * Citation picker (v0.4 §2 of the Papyru roadmap): library matches keep
 * working unchanged, plus a debounced external search that goes through a
 * type/page step before inserting. Only the citation branch is covered here
 * — the other picker kinds (crossref/figure/codeInclude) are unchanged and
 * untested before this file, so this doesn't expand to a general audit.
 */
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorSurface } from "./EditorSurface";
import type { BibEntry, EditorResources } from "./resources";

// vitest.config.ts doesn't set test.globals, so @testing-library/react's
// usual auto-cleanup (which detects a *global* afterEach) never registers —
// without this, DOM from one test leaks into the next render().
afterEach(cleanup);

function makeResources(overrides: Partial<EditorResources> = {}): EditorResources {
  return {
    imageUrl: () => null,
    textFilePreview: () => null,
    citationLabel: (keys) => `(${keys.join("; ")})`,
    bibEntries: [{ key: "silva2020", author: "Silva", title: "Um livro", year: "2020" }],
    labels: [],
    imageFiles: [],
    codeFiles: [],
    uploadImage: async () => null,
    searchCitations: async () => [],
    confirmCitation: (key) => key,
    ...overrides,
  };
}

function renderSurface(
  resources: EditorResources,
  source = "Texto.",
  onChange: (source: string) => void = () => {},
) {
  return render(
    <TooltipPrimitive.Provider>
      <EditorSurface
        path="doc.tex"
        source={source}
        resources={resources}
        onChange={onChange}
      />
    </TooltipPrimitive.Provider>,
  );
}

async function openCitationPicker() {
  fireEvent.click(await screen.findByTestId("toolbar-cite"));
}

function citationChipTitle() {
  const chip = screen.getByTestId("citation-chip");
  return chip.querySelector("span")?.getAttribute("title");
}

const SEARCH_HIT: BibEntry = {
  key: "novo2024",
  author: "Autor Novo",
  title: "Trabalho novo",
  year: "2024",
};

describe("EditorSurface citation picker", () => {
  it("still inserts a library match, now as citeonline instead of the old hardcoded cite", async () => {
    renderSurface(makeResources());
    await openCitationPicker();

    fireEvent.click(await screen.findByTestId("pick-cite-silva2020"));

    await screen.findByTestId("citation-chip");
    expect(citationChipTitle()).toBe("\\citeonline{silva2020}");
  });

  it("does not search below the 3-character minimum", async () => {
    const searchCitations = vi.fn().mockResolvedValue([]);
    renderSurface(makeResources({ searchCitations }));
    await openCitationPicker();

    fireEvent.change(screen.getByTestId("picker-search"), { target: { value: "ab" } });
    await new Promise((r) => setTimeout(r, 500));

    expect(searchCitations).not.toHaveBeenCalled();
  });

  it("debounces an external search and lists results in their own section", async () => {
    const searchCitations = vi.fn().mockResolvedValue([SEARCH_HIT]);
    renderSurface(makeResources({ searchCitations }));
    await openCitationPicker();

    fireEvent.change(screen.getByTestId("picker-search"), {
      target: { value: "trabalho novo" },
    });

    await waitFor(() => expect(searchCitations).toHaveBeenCalledWith("trabalho novo"), {
      timeout: 1000,
    });
    // findByTestId itself throws/rejects if the element never appears — that is the assertion.
    await screen.findByTestId("pick-cite-novo2024");
  });

  it("picking a search result opens the type step; Indireta inserts a plain citeonline", async () => {
    const confirmCitation = vi.fn((key: string) => key);
    renderSurface(
      makeResources({
        searchCitations: vi.fn().mockResolvedValue([SEARCH_HIT]),
        confirmCitation,
      }),
    );
    await openCitationPicker();
    fireEvent.change(screen.getByTestId("picker-search"), {
      target: { value: "trabalho novo" },
    });
    fireEvent.click(await screen.findByTestId("pick-cite-novo2024"));

    await screen.findByTestId("citation-type-step");
    fireEvent.click(screen.getByTestId("citation-type-confirm"));

    expect(confirmCitation).toHaveBeenCalledWith("novo2024");
    await screen.findByTestId("citation-chip");
    expect(citationChipTitle()).toBe("\\citeonline{novo2024}");
  });

  it("Direta with a page number round-trips through opt in the serialized LaTeX", async () => {
    renderSurface(
      makeResources({ searchCitations: vi.fn().mockResolvedValue([SEARCH_HIT]) }),
    );
    await openCitationPicker();
    fireEvent.change(screen.getByTestId("picker-search"), {
      target: { value: "trabalho novo" },
    });
    fireEvent.click(await screen.findByTestId("pick-cite-novo2024"));
    await screen.findByTestId("citation-type-step");

    fireEvent.click(screen.getByTestId("citation-type-direta"));
    fireEvent.change(screen.getByTestId("citation-page-input"), {
      target: { value: "45" },
    });
    fireEvent.click(screen.getByTestId("citation-type-confirm"));
    await screen.findByTestId("citation-chip");

    const win = window as unknown as {
      __uecetexEditor: { getJSON: () => unknown };
      __serialize: (json: unknown) => string;
    };
    expect(win.__serialize(win.__uecetexEditor.getJSON())).toContain(
      "\\citeonline[p. 45]{novo2024}",
    );
  });

  it("cites the key confirmCitation resolves to, not the search hit's own key (library dedup)", async () => {
    const confirmCitation = vi.fn(() => "existing2019");
    renderSurface(
      makeResources({
        searchCitations: vi.fn().mockResolvedValue([
          {
            key: "duplicado2024",
            author: "Duplicado",
            title: "Mesmo trabalho",
            year: "2024",
          },
        ]),
        confirmCitation,
      }),
    );
    await openCitationPicker();
    fireEvent.change(screen.getByTestId("picker-search"), {
      target: { value: "mesmo trabalho" },
    });
    fireEvent.click(await screen.findByTestId("pick-cite-duplicado2024"));
    fireEvent.click(await screen.findByTestId("citation-type-confirm"));

    await screen.findByTestId("citation-chip");
    expect(citationChipTitle()).toBe("\\citeonline{existing2019}");
  });

  it("Parentética inserts a plain \\cite instead of \\citeonline", async () => {
    renderSurface(
      makeResources({ searchCitations: vi.fn().mockResolvedValue([SEARCH_HIT]) }),
    );
    await openCitationPicker();
    fireEvent.change(screen.getByTestId("picker-search"), {
      target: { value: "trabalho novo" },
    });
    fireEvent.click(await screen.findByTestId("pick-cite-novo2024"));
    await screen.findByTestId("citation-type-step");

    fireEvent.click(screen.getByTestId("citation-form-parentetica"));
    fireEvent.click(screen.getByTestId("citation-type-confirm"));

    await screen.findByTestId("citation-chip");
    expect(citationChipTitle()).toBe("\\cite{novo2024}");
  });

  it("Parentética + Direta with a page number round-trips through opt in the serialized LaTeX", async () => {
    renderSurface(
      makeResources({ searchCitations: vi.fn().mockResolvedValue([SEARCH_HIT]) }),
    );
    await openCitationPicker();
    fireEvent.change(screen.getByTestId("picker-search"), {
      target: { value: "trabalho novo" },
    });
    fireEvent.click(await screen.findByTestId("pick-cite-novo2024"));
    await screen.findByTestId("citation-type-step");

    fireEvent.click(screen.getByTestId("citation-form-parentetica"));
    fireEvent.click(screen.getByTestId("citation-type-direta"));
    fireEvent.change(screen.getByTestId("citation-page-input"), {
      target: { value: "45" },
    });
    fireEvent.click(screen.getByTestId("citation-type-confirm"));
    await screen.findByTestId("citation-chip");

    const win = window as unknown as {
      __uecetexEditor: { getJSON: () => unknown };
      __serialize: (json: unknown) => string;
    };
    expect(win.__serialize(win.__uecetexEditor.getJSON())).toContain(
      "\\cite[p. 45]{novo2024}",
    );
  });
});

/**
 * A forma que o importador de PDF escreve — uma coluna `p{}` medida por coluna,
 * ou seja, chave dentro do cabeçalho de colunas. Fixture anônima, escrita à mão.
 */
const IMPORTED_QUADRO = [
  "\\begin{quadro}[htb]",
  "\\centering",
  "\\Caption{\\label{qua:criterios} Critérios comparados}",
  "\\UECEqua{}{",
  "\\begin{tabular}{p{0.4800\\dimexpr\\textwidth-4\\tabcolsep\\relax}p{0.4800\\dimexpr\\textwidth-4\\tabcolsep\\relax}}",
  "\\hline",
  "Critério & Resultado \\\\",
  "\\hline",
  "Cobertura & Total \\\\",
  "\\hline",
  "Suporte & Parcial \\\\",
  "\\hline",
  "\\end{tabular}",
  "}{",
  "\\Fonte{Elaborado pelo autor}",
  "}",
  "\\end{quadro}",
].join("\n");

describe("EditorSurface tables", () => {
  it("mostra como grade a tabela vinda de PDF, não como código", async () => {
    renderSurface(makeResources(), IMPORTED_QUADRO);

    expect(await screen.findByTestId("table-grid")).toBeTruthy();
    expect((screen.getByTestId("table-cell-0-0") as HTMLTextAreaElement).value).toBe(
      "Critério",
    );
    expect((screen.getByTestId("table-cell-2-1") as HTMLTextAreaElement).value).toBe(
      "Parcial",
    );
  });

  it("guarda uma célula longa numa linha só do LaTeX", async () => {
    const onChange = vi.fn();
    const longo = `${"Texto de célula bem comprido, ".repeat(12)}fim.`;
    renderSurface(makeResources(), IMPORTED_QUADRO, onChange);

    const cell = (await screen.findByTestId("table-cell-1-0")) as HTMLTextAreaElement;
    // Enter não pode entrar: dentro de uma célula, a quebra viraria `\\`.
    fireEvent.keyDown(cell, { key: "Enter" });
    fireEvent.change(cell, { target: { value: `${longo}\ncom quebra colada` } });
    fireEvent.blur(cell);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const emitted = onChange.mock.lastCall?.[0] as string;
    const row = emitted
      .split("\n")
      .find((line) => line.includes("Texto de célula bem comprido"));
    expect(row).toBe(`${longo} com quebra colada & Total \\\\`);
    expect(emitted).toContain("Suporte & Parcial \\\\");
  });

  it("insere e remove linha mantendo o resto verbatim", async () => {
    const onChange = vi.fn();
    renderSurface(makeResources(), IMPORTED_QUADRO, onChange);

    fireEvent.click(await screen.findByTestId("table-add-row-1"));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.lastCall?.[0]).toContain(
      ["Cobertura & Total \\\\", "\\hline", " &  \\\\", "\\hline"].join("\n"),
    );

    onChange.mockClear();
    fireEvent.click(screen.getByTestId("table-remove-row-0"));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const emitted = onChange.mock.lastCall?.[0] as string;
    expect(emitted).not.toContain("Critério & Resultado");
    expect(emitted).toContain("Cobertura & Total \\\\");
    expect(emitted).toContain("\\Fonte{Elaborado pelo autor}");
  });

  it("edita legenda e fonte da tabela sem perder o rótulo", async () => {
    const onChange = vi.fn();
    renderSurface(makeResources(), IMPORTED_QUADRO, onChange);

    const caption = await screen.findByTestId("table-caption");
    fireEvent.change(caption, { target: { value: "Critérios revisados" } });
    fireEvent.blur(caption);
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        expect.stringContaining("\\Caption{\\label{qua:criterios} Critérios revisados}"),
      ),
    );

    const fonte = screen.getByTestId("table-fonte");
    fireEvent.change(fonte, { target: { value: "Pesquisa direta" } });
    fireEvent.blur(fonte);
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        expect.stringContaining("\\Fonte{Pesquisa direta}"),
      ),
    );
  });
});

describe("EditorSurface figures", () => {
  it("keeps the UECE source after editing caption and fonte", async () => {
    const onChange = vi.fn();
    const source = [
      "\\begin{figure}[ht!]",
      "\\centering",
      "\\Caption{\\label{fig:exemplo}Legenda inicial}",
      "\\UECEfig{}{",
      "\\fbox{\\includegraphics[width=8cm]{figuras/figura-1}}",
      "}{",
      "\\Fonte{Elaborado pelo autor}",
      "}",
      "\\end{figure}",
    ].join("\n");
    renderSurface(makeResources(), source, onChange);

    fireEvent.change(await screen.findByTestId("figure-caption"), {
      target: { value: "Legenda atualizada" },
    });
    fireEvent.change(screen.getByTestId("figure-fonte"), {
      target: { value: "Arquivo institucional" },
    });

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        expect.stringContaining("\\Fonte{Arquivo institucional}"),
      ),
    );
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining("\\Caption{\\label{fig:exemplo}Legenda atualizada}"),
    );
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("\\UECEfig{}{"));
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("\\fbox{"));
  });
});
