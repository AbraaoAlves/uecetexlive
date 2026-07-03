import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildIncludeGraph } from "../include-graph";

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
});
