/**
 * Custom Tiptap nodes/marks (§4.2/§4.4). Schema shapes MUST mirror
 * latex-mapping's PM-JSON exactly — the editor is a projection of the LaTeX
 * source, parse on open / serialize on save.
 */
import { Extension, mergeAttributes, Node } from "@tiptap/core";
import { Blockquote } from "@tiptap/extension-blockquote";
import { Bold } from "@tiptap/extension-bold";
import { Code } from "@tiptap/extension-code";
import { CodeBlock } from "@tiptap/extension-code-block";
import { Heading } from "@tiptap/extension-heading";
import { Italic } from "@tiptap/extension-italic";
import { Underline } from "@tiptap/extension-underline";

/** Fidelity attrs every block carries (parser bookkeeping, §4.3). */
export const FidelityAttributes = Extension.create({
  name: "fidelityAttributes",
  addGlobalAttributes() {
    return [
      {
        types: [
          "paragraph",
          "heading",
          "bulletList",
          "orderedList",
          "blockquote",
          "codeBlock",
          "rawLatexBlock",
          "mathBlock",
          "latexFigure",
          "latexTable",
          "codeInclude",
          "latexComment",
        ],
        attributes: {
          gapBefore: { default: null, rendered: false, keepOnSplit: false },
          srcLine: { default: null, rendered: false, keepOnSplit: false },
        },
      },
      {
        types: [
          "bulletList",
          "orderedList",
          "blockquote",
          "codeBlock",
          "mathBlock",
          "latexFigure",
          "latexTable",
          "codeInclude",
        ],
        attributes: {
          rawSource: { default: null, rendered: false, keepOnSplit: false },
        },
      },
    ];
  },
});

const cmdAttr = (dflt: string) => ({
  cmd: { default: dflt, rendered: false },
});

export const LatexHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      cmd: { default: null, rendered: false },
      starred: { default: false, rendered: false },
    };
  },
}).configure({ levels: [1, 2, 3, 4] });

export const LatexBold = Bold.extend({
  addAttributes: () => cmdAttr("textbf"),
});
export const LatexItalic = Italic.extend({
  addAttributes: () => cmdAttr("textit"),
});
export const LatexUnderline = Underline.extend({
  addAttributes: () => cmdAttr("underline"),
});
export const LatexCode = Code.extend({
  addAttributes: () => cmdAttr("texttt"),
});

export const Citacao = Blockquote.extend({
  addAttributes() {
    return { env: { default: "citacao", rendered: false } };
  },
});

export const LatexCodeBlock = CodeBlock.extend({
  addAttributes() {
    return { language: { default: null, rendered: false } };
  },
});

export const RawLatexBlock = Node.create({
  name: "rawLatexBlock",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,
  parseHTML: () => [{ tag: "pre[data-raw-latex]", preserveWhitespace: "full" }],
  renderHTML({ HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(HTMLAttributes, {
        "data-raw-latex": "1",
        class: "uecetex-raw-block",
        title: "LaTeX bruto — o UeceTexLive preserva este trecho exatamente como está",
      }),
      ["code", 0],
    ];
  },
});

export const RawLatexInline = Node.create({
  name: "rawLatexInline",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { latex: { default: "" } };
  },
  parseHTML: () => [{ tag: "span[data-raw-latex-inline]" }],
  renderHTML({ node }) {
    return [
      "span",
      {
        "data-raw-latex-inline": "1",
        class: "uecetex-raw-inline",
        title: "LaTeX bruto — o UeceTexLive preserva este trecho exatamente como está",
      },
      node.attrs.latex as string,
    ];
  },
});

export const LatexComment = Node.create({
  name: "latexComment",
  group: "block",
  atom: true,
  addAttributes() {
    return { text: { default: "" } };
  },
  parseHTML: () => [{ tag: "div[data-latex-comment]" }],
  renderHTML({ node }) {
    return [
      "div",
      { "data-latex-comment": "1", class: "uecetex-comment" },
      `%${node.attrs.text as string}`,
    ];
  },
});
