import { describe, expect, it } from "vitest";
import { parseLatex } from "../parse";
import { serializeDoc } from "../serialize";
import type { PMDoc, PMNode } from "../types";

const roundTrip = (s: string) => serializeDoc(parseLatex(s).doc);
const blocks = (s: string) => parseLatex(s).doc.content;
const first = (s: string) => blocks(s)[0] as PMNode;

/** Build a generated doc (no rawSource/gap attrs — the WYSIWYG path). */
const doc = (...content: PMNode[]): PMDoc => ({ type: "doc", content });
const text = (t: string, marks?: PMNode["marks"]): PMNode => ({
  type: "text",
  text: t,
  ...(marks ? { marks } : {}),
});

describe("headings (§4.2)", () => {
  it.each([
    ["\\chapter{Introdução}", 1, "chapter", "Introdução"],
    ["\\section{Motivação}", 2, "section", "Motivação"],
    ["\\subsection{Objetivo Geral}", 3, "subsection", "Objetivo Geral"],
    ["\\subsubsection{Detalhe}", 4, "subsubsection", "Detalhe"],
  ])("%s -> heading level %i", (src, level, cmd, textContent) => {
    const node = first(src);
    expect(node.type).toBe("heading");
    expect(node.attrs).toMatchObject({ level, cmd });
    expect(node.content?.[0]?.text).toBe(textContent);
    expect(roundTrip(src)).toBe(src);
  });

  it("starred heading keeps the star", () => {
    const src = "\\section*{Sem número}";
    const node = first(src);
    expect(node.attrs).toMatchObject({ starred: true });
    expect(roundTrip(src)).toBe(src);
  });

  it("generated heading serializes canonically", () => {
    const generated = doc({
      type: "heading",
      attrs: { level: 1, cmd: "chapter", starred: false },
      content: [text("Novo Capítulo")],
    });
    expect(serializeDoc(generated)).toBe("\\chapter{Novo Capítulo}");
  });

  it("heading followed by label line and paragraph (corpus shape)", () => {
    const src = "\\chapter{Introdução}\n\\label{cap:introducao}\n\nTexto aqui.";
    const content = blocks(src);
    expect(content[0]?.type).toBe("heading");
    expect(content.at(-1)?.type).toBe("paragraph");
    expect(roundTrip(src)).toBe(src);
  });
});

describe("text marks (§4.2)", () => {
  it.each([
    ["\\textbf{negrito}", "bold", "textbf"],
    ["\\textit{itálico}", "italic", "textit"],
    ["\\emph{ênfase}", "italic", "emph"],
    ["\\underline{sublinhado}", "underline", "underline"],
    ["\\texttt{mono}", "code", "texttt"],
  ])("%s -> %s mark (cmd=%s)", (src, markType, cmd) => {
    const para = first(`Um ${src} aqui.`);
    expect(para.type).toBe("paragraph");
    const marked = para.content?.find((n) => n.marks?.length);
    expect(marked?.marks?.[0]).toMatchObject({ type: markType, attrs: { cmd } });
    expect(roundTrip(`Um ${src} aqui.`)).toBe(`Um ${src} aqui.`);
  });

  it("nested bold+italic round-trips", () => {
    const src = "\\textbf{\\textit{ambos}}";
    expect(roundTrip(src)).toBe(src);
  });

  it("generated marked text serializes with remembered cmd", () => {
    const generated = doc({
      type: "paragraph",
      content: [
        text("veja "),
        text("isto", [{ type: "italic", attrs: { cmd: "emph" } }]),
      ],
    });
    expect(serializeDoc(generated)).toBe("veja \\emph{isto}");
  });
});

describe("paragraphs, escapes and comments", () => {
  it("plain paragraph is promoted", () => {
    const node = first("Lorem ipsum dolor sit amet.");
    expect(node.type).toBe("paragraph");
  });

  it("multiple paragraphs keep their exact gap", () => {
    const src = "Primeiro.\n\n\nSegundo.";
    expect(roundTrip(src)).toBe(src);
    expect(blocks(src)).toHaveLength(2);
  });

  it("escaped specials become literal text and re-escape on serialize", () => {
    const src = "Cem por cento: 100\\% \\& algo\\_mais";
    const para = first(src);
    expect(para.content?.map((n) => n.text).join("")).toBe(
      "Cem por cento: 100% & algo_mais",
    );
    expect(roundTrip(src)).toBe(src);
  });

  it("own-line comment becomes latexComment block", () => {
    const src = "% um comentário\n\nTexto.";
    const content = blocks(src);
    expect(content[0]?.type).toBe("latexComment");
    expect(roundTrip(src)).toBe(src);
  });

  it("soft-wrapped paragraph falls back to byte-exact source", () => {
    const src = "Uma linha\noutra linha do mesmo parágrafo.";
    expect(roundTrip(src)).toBe(src);
  });

  it("~ (nbsp) is preserved as text", () => {
    const src = "Veja~isto.";
    expect(roundTrip(src)).toBe(src);
  });
});

describe("lists (§4.2)", () => {
  it("itemize -> bulletList with items", () => {
    const src = "\\begin{itemize}\n\\item Um\n\\item Dois\n\\end{itemize}";
    const node = first(src);
    expect(node.type).toBe("bulletList");
    expect(node.content).toHaveLength(2);
    expect(node.content?.[0]?.type).toBe("listItem");
    expect(roundTrip(src)).toBe(src);
  });

  it("enumerate -> orderedList", () => {
    const src = "\\begin{enumerate}\n\\item Primeiro\n\\item Segundo\n\\end{enumerate}";
    expect(first(src).type).toBe("orderedList");
    expect(roundTrip(src)).toBe(src);
  });

  it("corpus-style indented alineas env stays rawLatex (not whitelisted)", () => {
    const src =
      "\\begin{alineas}\n\t\\item Lorem ipsum.\n\t\\item Praesent vitae.\n\\end{alineas}";
    expect(first(src).type).toBe("rawLatexBlock");
    expect(roundTrip(src)).toBe(src);
  });

  it("nested lists round-trip", () => {
    const src =
      "\\begin{itemize}\n\\item Fora\n\\begin{itemize}\n\\item Dentro\n\\end{itemize}\n\\end{itemize}";
    expect(roundTrip(src)).toBe(src);
  });

  it("generated bulletList serializes canonically", () => {
    const generated = doc({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [text("Um")] }],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [text("Dois")] }],
        },
      ],
    });
    expect(serializeDoc(generated)).toBe(
      "\\begin{itemize}\n\\item Um\n\\item Dois\n\\end{itemize}",
    );
  });
});

describe("citacao (ABNT long quote)", () => {
  it("citacao env -> blockquote with env attr", () => {
    const src = "\\begin{citacao}\nUma citação longa aqui.\n\\end{citacao}";
    const node = first(src);
    expect(node.type).toBe("blockquote");
    expect(node.attrs).toMatchObject({ env: "citacao" });
    expect(roundTrip(src)).toBe(src);
  });

  it("generated citacao serializes canonically", () => {
    const generated = doc({
      type: "blockquote",
      attrs: { env: "citacao" },
      content: [{ type: "paragraph", content: [text("Citação nova.")] }],
    });
    expect(serializeDoc(generated)).toBe(
      "\\begin{citacao}\nCitação nova.\n\\end{citacao}",
    );
  });
});

describe("citations (§4.2)", () => {
  it("\\cite with one key", () => {
    const para = first("Veja \\cite{lamport1986latex} aqui.");
    const cite = para.content?.find((n) => n.type === "citation");
    expect(cite?.attrs).toMatchObject({ cmd: "cite", keys: ["lamport1986latex"] });
    expect(roundTrip("Veja \\cite{lamport1986latex} aqui.")).toBe(
      "Veja \\cite{lamport1986latex} aqui.",
    );
  });

  it("multi-key \\cite", () => {
    const para = first("\\cite{a,b,c}");
    const cite = para.content?.find((n) => n.type === "citation");
    expect(cite?.attrs).toMatchObject({ keys: ["a", "b", "c"] });
  });

  it("\\citeonline", () => {
    const src = "Como \\citeonline{Maia2011} afirma.";
    const para = first(src);
    const cite = para.content?.find((n) => n.type === "citation");
    expect(cite?.attrs).toMatchObject({ cmd: "citeonline", keys: ["Maia2011"] });
    expect(roundTrip(src)).toBe(src);
  });

  it("\\cite with optional arg keeps it", () => {
    const src = "\\cite[p.~3]{key}";
    expect(roundTrip(src)).toBe(src);
  });

  it("generated citation serializes canonically", () => {
    const generated = doc({
      type: "paragraph",
      content: [
        {
          type: "citation",
          attrs: { cmd: "cite", keys: ["a", "b"], opt: null },
        },
      ],
    });
    expect(serializeDoc(generated)).toBe("\\cite{a,b}");
  });
});

describe("cross-references (§4.2)", () => {
  it.each(["ref", "autoref", "pageref"])("\\%s{...} -> crossref", (cmd) => {
    const src = `Ver \\${cmd}{sec:motivacao}.`;
    const para = first(src);
    const node = para.content?.find((n) => n.type === "crossref");
    expect(node?.attrs).toMatchObject({ cmd, target: "sec:motivacao" });
    expect(roundTrip(src)).toBe(src);
  });

  it("standalone \\label line survives byte-exact", () => {
    const src = "\\label{cap:introducao}";
    expect(roundTrip(src)).toBe(src);
  });
});

describe("math (§4.2)", () => {
  it("$...$ -> inline math", () => {
    const src = "Seja $x^2 + 1$ dado.";
    const para = first(src);
    const math = para.content?.find((n) => n.type === "mathInline");
    expect(math?.attrs).toMatchObject({ tex: "x^2 + 1" });
    expect(roundTrip(src)).toBe(src);
  });

  it("\\(...\\) -> inline math with paren delim", () => {
    const src = "Seja \\(y\\) dado.";
    expect(roundTrip(src)).toBe(src);
  });

  it("equation env -> mathBlock", () => {
    const src = "\\begin{equation}\nE = mc^2\n\\end{equation}";
    const node = first(src);
    expect(node.type).toBe("mathBlock");
    expect(node.attrs).toMatchObject({ env: "equation" });
    expect(roundTrip(src)).toBe(src);
  });

  it("\\[...\\] -> mathBlock", () => {
    const src = "\\[\nx = 1\n\\]";
    expect(first(src).type).toBe("mathBlock");
    expect(roundTrip(src)).toBe(src);
  });

  it("$ inside text with edge spacing", () => {
    const src = "a $b$ c $d$ e";
    expect(roundTrip(src)).toBe(src);
  });
});

describe("figures (§4.2)", () => {
  const src = `\\begin{figure}[htb]
\t\\caption{\\label{fig-grafico-1}Um exemplo de gráfico}
\t\\begin{center}
\t    \\includegraphics[scale=0.6]{figuras/figura-3}
\t\\end{center}
\t\\legend{Fonte: \\citeonline{ibge23}}
\\end{figure}`;

  it("figure env -> latexFigure atom with extracted attrs", () => {
    const node = first(src);
    expect(node.type).toBe("latexFigure");
    expect(node.attrs).toMatchObject({
      src: "figuras/figura-3",
      options: "scale=0.6",
      label: "fig-grafico-1",
      fonte: "\\citeonline{ibge23}",
    });
  });

  it("figure round-trips byte-exact (options string preserved)", () => {
    expect(roundTrip(src)).toBe(src);
  });

  it("generated figure serializes canonically", () => {
    const generated = doc({
      type: "latexFigure",
      attrs: {
        src: "figuras/nova.png",
        options: "width=0.8\\textwidth",
        caption: "Nova figura",
        label: "fig:nova",
        placement: "htb",
        fonte: "Elaborado pelo autor",
      },
    });
    expect(serializeDoc(generated)).toBe(
      "\\begin{figure}[htb]\n\t\\centering\n\t\\Caption{\\label{fig:nova}Nova figura}\n\t\\UECEfig{}{\n\t\t\\fbox{\\includegraphics[width=0.8\\textwidth]{figuras/nova.png}}\n\t}{\n\t\t\\Fonte{Elaborado pelo autor}\n\t}\n\\end{figure}",
    );
  });

  it.each([
    "",
    "   ",
  ])("omits \\Fonte entirely when the field was cleared (%j)", (fonte) => {
    const generated = doc({
      type: "latexFigure",
      attrs: {
        src: "figuras/nova.png",
        options: null,
        caption: "Nova figura",
        label: null,
        placement: "htb",
        fonte,
      },
    });
    // Uma \Fonte vazia sai como linha "Fonte:" em branco no PDF e ainda faz
    // a conformidade dar a figura por correta.
    expect(serializeDoc(generated)).not.toContain("\\Fonte");
  });

  it("serializes a figure node that has no fonte attribute at all", () => {
    const generated = doc({
      type: "latexFigure",
      attrs: { src: "figuras/nova.png", caption: "Nova figura", placement: "htb" },
    });
    expect(serializeDoc(generated)).not.toContain("\\Fonte");
  });

  it("preserves the UECE source after changing a figure caption", () => {
    const ueceFigure = [
      "\\begin{figure}[ht!]",
      "\\centering",
      "\\Caption{\\label{fig:exemplo-1} Exemplo de figura}",
      "\\UECEfig{}{",
      "\\fbox{\\includegraphics[width=8cm]{figuras/figura-1}}",
      "}{",
      "\\Fonte{Elaborado pelo autor}",
      "}",
      "\\end{figure}",
    ].join("\n");
    const figure = first(ueceFigure);
    expect(figure.attrs).toMatchObject({ fonte: "Elaborado pelo autor" });

    const edited = doc({
      ...figure,
      attrs: { ...figure.attrs, caption: "Legenda atualizada", rawSource: null },
    });

    expect(serializeDoc(edited)).toBe(
      "\\begin{figure}[ht!]\n\t\\centering\n\t\\Caption{\\label{fig:exemplo-1}Legenda atualizada}\n\t\\UECEfig{}{\n\t\t\\fbox{\\includegraphics[width=8cm]{figuras/figura-1}}\n\t}{\n\t\t\\Fonte{Elaborado pelo autor}\n\t}\n\\end{figure}",
    );
  });
});

describe("code (§4.2)", () => {
  it("\\lstinputlisting -> codeInclude atom", () => {
    const src = "\\lstinputlisting[language=C++]{figuras/main.cpp}";
    const node = first(src);
    expect(node.type).toBe("codeInclude");
    expect(node.attrs).toMatchObject({ file: "figuras/main.cpp" });
    expect(roundTrip(src)).toBe(src);
  });

  it("lstlisting env -> codeBlock with text content", () => {
    const src = "\\begin{lstlisting}[language=Java]\nint x = 1;\n\\end{lstlisting}";
    const node = first(src);
    expect(node.type).toBe("codeBlock");
    expect(node.attrs).toMatchObject({ language: "Java" });
    expect(node.content?.[0]?.text).toBe("int x = 1;");
    expect(roundTrip(src)).toBe(src);
  });
});

describe("footnotes (§4.2)", () => {
  it("\\footnote -> footnote inline node", () => {
    const src = "Texto\\footnote{Uma nota}.";
    const para = first(src);
    const note = para.content?.find((n) => n.type === "footnote");
    expect(note?.attrs).toMatchObject({ latex: "Uma nota" });
    expect(roundTrip(src)).toBe(src);
  });
});

describe("tables (read-only projection, §4.2)", () => {
  it("table env -> latexTable atom, byte-exact", () => {
    const src =
      "\\begin{table}[ht!]\n\\begin{tabular}{cc}\nA & B \\\\\n\\end{tabular}\n\\end{table}";
    const node = first(src);
    expect(node.type).toBe("latexTable");
    expect(roundTrip(src)).toBe(src);
  });

  it("generated latexTable (3×3 scaffold) serializes its rawSource", () => {
    const rawSource =
      "\\begin{table}[htb]\n\t\\centering\n\t\\caption{Legenda}\n\t\\begin{tabular}{ccc}\n\t\tA & B & C \\\\\n\t\\end{tabular}\n\\end{table}";
    const generated = doc({ type: "latexTable", attrs: { rawSource } });
    expect(serializeDoc(generated)).toBe(rawSource);
  });
});

describe("stale gapBefore (QA §M2)", () => {
  it("block demoted from first position regains a blank-line gap", () => {
    // Parse a doc whose heading is the first block (gapBefore: "").
    const { doc: parsed } = parseLatex("\\chapter{Intro}\n\nTexto.");
    const heading = parsed.content?.[0] as PMNode;
    expect(heading.attrs?.gapBefore).toBe("");
    // Simulate a WYSIWYG insert above it (e.g. figure/table scaffold).
    const inserted: PMNode = {
      type: "latexTable",
      attrs: { rawSource: "\\begin{table}\n\\end{table}" },
    };
    const moved = doc(inserted, ...(parsed.content ?? []));
    const out = serializeDoc(moved);
    expect(out).toContain("\\end{table}\n\n\\chapter{Intro}");
    expect(out).not.toContain("\\end{table}\\chapter");
  });
});

describe("unknown constructs stay rawLatex", () => {
  it.each([
    "\\begin{algorithm}[ht!]\n\\SetSpacedAlgorithm\n\\end{algorithm}",
    "\\newcommand{\\foo}{bar}",
    "\\trabalhoacademico{dissertacao}",
  ])("%s", (src) => {
    const node = first(src);
    expect(node.type).toBe("rawLatexBlock");
    // Raw blocks carry their bytes as editable text content (PM-native).
    expect(node.content?.map((n) => n.text).join("")).toBe(src);
    expect(roundTrip(src)).toBe(src);
  });
});
