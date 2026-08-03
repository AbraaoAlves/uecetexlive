import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildIncludeGraph, orderedTexPaths } from "../include-graph";

describe("buildIncludeGraph", () => {
  it("yields ordered inputs with .tex resolution", () => {
    const graph = buildIncludeGraph(
      {
        "main.tex": "\\input{a}\n\\input{sub/b}\n",
        "a.tex": "",
        "sub/b.tex": "",
      },
      "main.tex",
    );
    expect(graph.inputs).toEqual([
      { path: "a", resolved: "a.tex" },
      { path: "sub/b", resolved: "sub/b.tex" },
    ]);
  });

  it("does not count comment-masked \\input", () => {
    const graph = buildIncludeGraph(
      {
        "main.tex": "% \\input{ghost}\n\\input{real}\n",
        "real.tex": "",
      },
      "main.tex",
    );
    expect(graph.inputs.map((i) => i.path)).toEqual(["real"]);
  });

  it("flags missing include targets", () => {
    const graph = buildIncludeGraph({ "main.tex": "\\input{nowhere}\n" }, "main.tex");
    expect(graph.inputs).toEqual([{ path: "nowhere", resolved: null }]);
  });

  it("harvests labels recursively through the graph", () => {
    const graph = buildIncludeGraph(
      {
        "main.tex": "\\label{root}\\input{ch1}",
        "ch1.tex": "\\section{X}\\label{sec:x}\\input{deep}",
        "deep.tex": "\\label{deep:one}",
      },
      "main.tex",
    );
    expect(graph.labels).toEqual(["root", "sec:x", "deep:one"]);
  });

  it("puts a nested include right after the chapter that includes it", () => {
    const graph = buildIncludeGraph(
      {
        "main.tex": "\\input{cap1}\\input{cap2}",
        "cap1.tex": "\\input{secao}",
        "cap2.tex": "",
        "secao.tex": "",
        "solto.tex": "",
      },
      "main.tex",
    );

    // `inputs` só conhece o primeiro nível; a ordem de leitura desce junto.
    expect(graph.inputs.map((input) => input.resolved)).toEqual(["cap1.tex", "cap2.tex"]);
    expect(graph.readingOrder).toEqual(["main.tex", "cap1.tex", "secao.tex", "cap2.tex"]);
  });

  it("ordena o que está fora do grafo sem depender do idioma", () => {
    const sources = {
      "Zulu.tex": "",
      "apendice.tex": "",
      "Ápice.tex": "",
      "anexo.tex": "",
      "cap.tex": "",
    };

    // Comparação por unidade de código: maiúsculas antes de minúsculas e o
    // acentuado depois, sempre — sem tabela de intercalação no meio, a ordem é
    // a mesma em qualquer navegador.
    expect(orderedTexPaths(sources, ["cap.tex"])).toEqual([
      "cap.tex",
      "Zulu.tex",
      "anexo.tex",
      "apendice.tex",
      "Ápice.tex",
    ]);
  });

  it("harvests bibliography target and style", () => {
    const graph = buildIncludeGraph(
      {
        "main.tex":
          "\\bibliographystyle{lib/abntex2-alf.bst}\n\\bibliography{elementos-pos-textuais/referencias}\n",
      },
      "main.tex",
    );
    expect(graph.bibliography).toBe("elementos-pos-textuais/referencias");
    expect(graph.bibliographyStyle).toBe("lib/abntex2-alf.bst");
  });

  it("handles \\include like \\input", () => {
    const graph = buildIncludeGraph(
      { "main.tex": "\\include{ch1}", "ch1.tex": "" },
      "main.tex",
    );
    expect(graph.inputs).toEqual([{ path: "ch1", resolved: "ch1.tex" }]);
  });

  it("survives a missing entry file", () => {
    const graph = buildIncludeGraph({}, "main.tex");
    expect(graph.inputs).toEqual([]);
    expect(graph.readingOrder).toEqual([]);
  });

  it("parses the real vendored documento.tex", () => {
    const root = join(__dirname, "../../../../public/templates/uecetex2/files");
    const read = (p: string) => readFileSync(join(root, p), "utf-8");
    const files: Record<string, string> = {
      "documento.tex": read("documento.tex"),
      "lib/preambulo.tex": read("lib/preambulo.tex"),
      "elementos-textuais/introducao.tex": read("elementos-textuais/introducao.tex"),
      "elementos-textuais/fundamentacao-teorica.tex": read(
        "elementos-textuais/fundamentacao-teorica.tex",
      ),
      "elementos-textuais/trabalhos-relacionados.tex": read(
        "elementos-textuais/trabalhos-relacionados.tex",
      ),
      "elementos-textuais/metodologia.tex": read("elementos-textuais/metodologia.tex"),
      "elementos-textuais/resultados.tex": read("elementos-textuais/resultados.tex"),
      "elementos-textuais/conclusao.tex": read("elementos-textuais/conclusao.tex"),
    };
    const graph = buildIncludeGraph(files, "documento.tex");

    // 1 preambulo + 6 chapters + 3 apendices + 2 anexos = 12 \input's
    expect(graph.inputs).toHaveLength(12);
    expect(graph.inputs[0]?.resolved).toBe("lib/preambulo.tex");

    const chapters = graph.inputs.filter((i) => i.path.startsWith("elementos-textuais/"));
    expect(chapters.map((c) => c.path)).toEqual([
      "elementos-textuais/introducao",
      "elementos-textuais/fundamentacao-teorica",
      "elementos-textuais/trabalhos-relacionados",
      "elementos-textuais/metodologia",
      "elementos-textuais/resultados",
      "elementos-textuais/conclusao",
    ]);

    expect(graph.bibliography).toBe("elementos-pos-textuais/referencias");
    expect(graph.bibliographyStyle).toBe("lib/abntex2-alf.bst");
    // apendices are not in `files` here → unresolved
    const missing = graph.inputs.filter((i) => i.resolved === null);
    expect(missing.length).toBe(5);
  });

  it("re-scans a file when its content changes (per-file scan cache)", () => {
    const files = {
      "main.tex": "\\input{a}\n",
      "a.tex": "\\label{sec:um}\n",
    };
    expect(buildIncludeGraph(files, "main.tex").labels).toEqual(["sec:um"]);
    // Equal content strings → cache hit; the result must be identical.
    expect(buildIncludeGraph({ ...files }, "main.tex").labels).toEqual(["sec:um"]);
    // Edited content → cache miss; the new label must surface.
    const edited = { ...files, "a.tex": "\\label{sec:um}\n\\label{sec:dois}\n" };
    expect(buildIncludeGraph(edited, "main.tex").labels).toEqual(["sec:um", "sec:dois"]);
    // Resolution stays live even on cache hits: same content, fewer files.
    const orphaned = buildIncludeGraph({ "main.tex": files["main.tex"] }, "main.tex");
    expect(orphaned.inputs[0]?.resolved).toBeNull();
  });
});
