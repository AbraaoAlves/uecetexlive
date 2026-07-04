import type { Meta, StoryObj } from "@storybook/react-vite";
import { SourceEditor } from "./SourceEditor";

const SAMPLE = `\\chapter{Introdução}
\\label{cap:introducao}

Lorem ipsum dolor sit amet, \\textbf{consectetur} adipiscing elit. Veja a
Equação~\\ref{eq:um} e a Figura~\\ref{fig:um}.

\\begin{equation}\\label{eq:um}
  E = mc^2
\\end{equation}

\\begin{figure}[htb]
  \\centering
  \\includegraphics[width=0.8\\textwidth]{figuras/figura-1}
  \\caption{\\label{fig:um}Uma figura de exemplo.}
\\end{figure}

% comentário de linha inteira
Como mostra \\cite{lamport1986latex}, o LaTeX é ótimo.`;

const meta = {
  title: "Editor/SourceEditor",
  component: SourceEditor,
  // CodeMirror fills its host — give the story a bounded viewport.
  decorators: [
    (Story) => (
      <div className="h-[28rem] w-full border">
        <Story />
      </div>
    ),
  ],
  args: {
    path: "elementos-textuais/introducao.tex",
    text: SAMPLE,
    readOnly: false,
    onChange: () => {},
  },
} satisfies Meta<typeof SourceEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LatexDocument: Story = {};

export const ReadOnly: Story = {
  args: { readOnly: true },
};

export const Empty: Story = {
  args: { text: "" },
};
