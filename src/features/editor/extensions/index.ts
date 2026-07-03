/**
 * Extension assembly (§4.4). One place decides the schema; latex-mapping's
 * PM-JSON must load into this schema unchanged.
 */
import type { Extension } from "@tiptap/core";
import { BulletList } from "@tiptap/extension-bullet-list";
import { Document } from "@tiptap/extension-document";
import { ListItem } from "@tiptap/extension-list-item";
import { OrderedList } from "@tiptap/extension-ordered-list";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import {
  Dropcursor,
  Gapcursor,
  Placeholder,
  TrailingNode,
  UndoRedo,
} from "@tiptap/extensions";
import { strings } from "@/lib/strings";
import { SlashMenu, type SlashMenuOptions } from "../slash-menu/slash-menu";
import {
  Citation,
  CodeInclude,
  CrossRef,
  Footnote,
  LatexFigure,
  LatexTable,
  MathBlock,
} from "./atoms";
import { MathInlineWithInput } from "./math-input-rule";
import {
  Citacao,
  FidelityAttributes,
  LatexBold,
  LatexCode,
  LatexCodeBlock,
  LatexComment,
  LatexHeading,
  LatexItalic,
  LatexUnderline,
  RawLatexBlock,
  RawLatexInline,
} from "./nodes";
import { PasteLatex } from "./paste-latex";
import { RawSourceGuard } from "./raw-source-guard";

/** The parser records inter-block whitespace on the doc too. */
const LatexDocument = Document.extend({
  content: "block*",
  addAttributes() {
    return { gapAfter: { default: null, rendered: false } };
  },
});

export interface BuildExtensionsOptions {
  openPicker: SlashMenuOptions["openPicker"];
}

export function buildExtensions({ openPicker }: BuildExtensionsOptions): Extension[] {
  return [
    LatexDocument,
    Paragraph,
    Text,
    LatexHeading,
    LatexBold,
    LatexItalic,
    LatexUnderline,
    LatexCode,
    BulletList,
    OrderedList,
    ListItem,
    Citacao,
    LatexCodeBlock,
    RawLatexBlock,
    RawLatexInline,
    LatexComment,
    Citation,
    CrossRef,
    MathInlineWithInput,
    MathBlock,
    LatexFigure,
    LatexTable,
    CodeInclude,
    Footnote,
    FidelityAttributes,
    RawSourceGuard,
    PasteLatex,
    UndoRedo,
    Dropcursor,
    Gapcursor,
    // Keeps an empty paragraph at doc end so the caret never gets trapped
    // inside a trailing raw/code block; serializeDoc drops it again.
    TrailingNode.configure({ node: "paragraph" }),
    Placeholder.configure({ placeholder: strings.editor.placeholder }),
    SlashMenu.configure({ openPicker }),
  ] as Extension[];
}
