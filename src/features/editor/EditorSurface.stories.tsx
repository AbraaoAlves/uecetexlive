import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorSurface } from "./EditorSurface";
import type { EditorResources } from "./resources";

const resources: EditorResources = {
  imageUrl: () => null,
  textFilePreview: (path) => `// preview de ${path}\nint main() { return 0; }`,
  citationLabel: (keys) => `(${keys.map((k) => k.toUpperCase()).join("; ")})`,
  bibEntries: [
    {
      key: "lamport1986latex",
      author: "Lamport",
      title: "LaTeX: A Document Preparation System",
      year: "1986",
    },
    { key: "Maia2011", author: "Maia", title: "Um trabalho exemplar", year: "2011" },
  ],
  labels: ["cap:introducao", "sec:motivacao", "fig-grafico-1"],
  imageFiles: ["figuras/figura-1.jpg", "figuras/figura-3.png"],
  codeFiles: ["figuras/main.cpp"],
};

const meta = {
  title: "Editor/EditorSurface",
  component: EditorSurface,
  args: {
    path: "story.tex",
    resources,
    onChange: () => {},
  },
} satisfies Meta<typeof EditorSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyDoc: Story = { args: { source: "" } };

export const Headings: Story = {
  args: {
    source:
      "\\chapter{Capítulo}\n\n\\section{Seção}\n\n\\subsection{Subseção}\n\n\\subsubsection{Sub-subseção}",
  },
};

export const MarksAndParagraphs: Story = {
  args: {
    source:
      "Um parágrafo com \\textbf{negrito}, \\textit{itálico}, \\emph{ênfase}, \\underline{sublinhado} e \\texttt{código}.\n\nSegundo parágrafo com 100\\% de escapes \\& coisas.",
  },
};

export const Lists: Story = {
  args: {
    source:
      "\\begin{itemize}\n\\item Primeiro\n\\item Segundo\n\\end{itemize}\n\n\\begin{enumerate}\n\\item Um\n\\item Dois\n\\end{enumerate}",
  },
};

export const CitacaoLonga: Story = {
  args: {
    source:
      "\\begin{citacao}\nUma citação longa no padrão ABNT, recuada 4 cm da margem esquerda.\n\\end{citacao}",
  },
};

export const CitationsAndRefs: Story = {
  args: {
    source:
      "Como \\cite{lamport1986latex} mostra, e também \\citeonline{Maia2011}, veja a \\ref{sec:motivacao}.",
  },
};

export const MathNodes: Story = {
  args: {
    source:
      "Inline $E = mc^2$ aqui.\n\n\\begin{equation}\nx = \\frac{1}{2}\n\\end{equation}",
  },
};

export const Figure: Story = {
  args: {
    source:
      "\\begin{figure}[htb]\n\t\\caption{\\label{fig:x}Uma figura}\n\t\\includegraphics[scale=0.6]{figuras/figura-3}\n\\end{figure}",
  },
};

export const TableProjection: Story = {
  args: {
    source:
      "\\begin{table}[ht!]\n\\begin{tabular}{cc}\nA & B \\\\\n1 & 2 \\\\\n\\end{tabular}\n\\end{table}",
  },
};

export const CodeBlocks: Story = {
  args: {
    source:
      "\\begin{lstlisting}[language=C++]\nint main() { return 0; }\n\\end{lstlisting}\n\n\\lstinputlisting[language=C++]{figuras/main.cpp}",
  },
};

export const FootnoteAndComment: Story = {
  args: {
    source: "Texto\\footnote{Uma nota de rodapé}.\n\n% um comentário de linha",
  },
};

export const RawLatex: Story = {
  args: {
    source:
      "\\trabalhoacademico{dissertacao}\n\nTexto com \\comandoDesconhecido{inline} no meio.\n\n\\begin{alineas}\n\t\\item Bloco desconhecido preservado byte a byte.\n\\end{alineas}",
  },
};
