/**
 * Extension assembly (§4.4). One place decides the schema; latex-mapping's
 * PM-JSON must load into this schema unchanged.
 */

import { ABNT_CITATION_PROFILE, type CitationProfile } from "@papyru/latex-mapping";
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
import { SlashMenu, type SlashMenuOptions } from "../slash-menu/slash-menu";
import { DEFAULT_EDITOR_STRINGS, type EditorStrings } from "../strings";
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
import { UecetexSearch } from "./search";

/** The parser records inter-block whitespace on the doc too. */
const LatexDocument = Document.extend({
  content: "block*",
  addAttributes() {
    return { gapAfter: { default: null, rendered: false } };
  },
});

export interface BuildExtensionsOptions {
  openPicker: SlashMenuOptions["openPicker"];
  /** Norma de citação — mesmo objeto de config do @papyru/latex-mapping. */
  citationProfile?: CitationProfile;
  /** Copy dos textos que vivem dentro do schema (placeholder, tooltips). */
  strings?: EditorStrings;
}

export function buildExtensions({
  openPicker,
  citationProfile = ABNT_CITATION_PROFILE,
  strings = DEFAULT_EDITOR_STRINGS,
}: BuildExtensionsOptions): Extension[] {
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
    Citacao.configure({ env: citationProfile.longQuoteEnv }),
    LatexCodeBlock,
    RawLatexBlock.configure({ tooltip: strings.editor.rawLatexTooltip }),
    RawLatexInline.configure({ tooltip: strings.editor.rawLatexTooltip }),
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
    UecetexSearch,
    UndoRedo,
    Dropcursor,
    Gapcursor,
    TrailingNode.configure({ node: "paragraph" }),
    Placeholder.configure({ placeholder: strings.editor.placeholder }),
    SlashMenu.configure({ openPicker }),
  ] as Extension[];
}
