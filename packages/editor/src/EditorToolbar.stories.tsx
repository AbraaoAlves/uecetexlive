import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorContent, useEditor } from "@tiptap/react";
import { parseLatex } from "@uecetexlive/latex-mapping";
import { EditorToolbar } from "./EditorToolbar";
import { buildExtensions } from "./extensions";

/**
 * The fixed toolbar needs a live Tiptap instance to reflect active marks;
 * this harness mounts a minimal editor and renders the toolbar above it.
 */
function ToolbarHarness({ source }: { source: string }) {
  const editor = useEditor({
    extensions: buildExtensions({ openPicker: () => {} }),
    content: parseLatex(source).doc as never,
  });
  if (!editor) return null;
  return (
    <div className="w-full border">
      <EditorToolbar editor={editor} onOpenPicker={() => {}} />
      <EditorContent
        editor={editor}
        className="prose max-w-none p-4 [&_.ProseMirror]:outline-none"
      />
    </div>
  );
}

const meta = {
  title: "Editor/EditorToolbar",
  component: ToolbarHarness,
} satisfies Meta<typeof ToolbarHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Paragraph: Story = {
  args: {
    source:
      "Um parágrafo com \\textbf{negrito} e \\textit{itálico} para formatar pela barra.",
  },
};

export const Headings: Story = {
  args: {
    source: "\\chapter{Capítulo}\n\n\\section{Seção}\n\n\\subsection{Subseção}",
  },
};

export const Lists: Story = {
  args: {
    source: "\\begin{itemize}\n\\item Primeiro item\n\\item Segundo item\n\\end{itemize}",
  },
};
