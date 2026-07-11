/**
 * Resumo/Abstract body + keyword macro (§F2/3.1) — elementos-pre-textuais/
 * {resumo,abstract}.tex aren't a macro-argument block like documento.tex's
 * metadata; the editable "body" is free prose that ends right where the
 * \palavraschave{}/\keywords{} macro begins. Same surgical-splice discipline
 * as metadata.ts (byte-offset splice, file is the source of truth), just
 * with the body's boundary being "everything before a known macro" instead
 * of a macro's own argument.
 */

import { sliceArgs } from "@papyru/latex-mapping";
import type * as Ast from "@unified-latex/unified-latex-types";
import { parse } from "@unified-latex/unified-latex-util-parse";
import { walk } from "./include-graph";

export type ResumoKeywordMacro = "palavraschave" | "keywords";

/** Where these files live in every uecetex2 project (see template-structure.ts). */
export const RESUMO_PATH = "elementos-pre-textuais/resumo.tex";
export const ABSTRACT_PATH = "elementos-pre-textuais/abstract.tex";

export interface ResumoField {
  /** Every byte of the file before the keyword macro — the resumo/abstract prose. */
  body: string;
  bodyStart: number;
  bodyEnd: number;
  /** Group content of \palavraschave{}/\keywords{}. */
  keywords: string;
  keywordsStart: number;
  keywordsEnd: number;
}

function macroPosition(macro: Ast.Macro): { start: number; end: number } | null {
  const pos = (
    macro as { position?: { start: { offset: number }; end: { offset: number } } }
  ).position;
  return pos ? { start: pos.start.offset, end: pos.end.offset } : null;
}

/** LaTeX \def semantics: the last occurrence of the keyword macro wins. */
export function extractResumoField(
  source: string,
  keywordMacro: ResumoKeywordMacro,
): ResumoField | null {
  let ast: Ast.Root;
  try {
    ast = parse(source);
  } catch {
    return null;
  }

  let field: ResumoField | null = null;
  walk(ast.content, (macro) => {
    if (macro.content !== keywordMacro) return;
    const pos = macroPosition(macro);
    if (!pos) return;
    let from = pos.end;
    while (source[from] === " " || source[from] === "\t") from++;
    const slices = sliceArgs(source, from, false);
    if (!slices || slices.mandatory === null) return;
    const keywordsEnd = slices.end - 1; // closing brace
    field = {
      body: source.slice(0, pos.start),
      bodyStart: 0,
      bodyEnd: pos.start,
      keywords: slices.mandatory,
      keywordsStart: keywordsEnd - slices.mandatory.length,
      keywordsEnd,
    };
  });
  return field;
}

export function applyResumoField(
  source: string,
  field: ResumoField,
  updates: { body?: string; keywords?: string },
): string {
  const splices: Array<{ start: number; end: number; value: string }> = [];
  if (updates.body !== undefined && updates.body !== field.body) {
    splices.push({ start: field.bodyStart, end: field.bodyEnd, value: updates.body });
  }
  if (updates.keywords !== undefined && updates.keywords !== field.keywords) {
    splices.push({
      start: field.keywordsStart,
      end: field.keywordsEnd,
      value: updates.keywords,
    });
  }
  // Descending start order: earlier offsets stay valid while splicing.
  splices.sort((a, b) => b.start - a.start);
  let result = source;
  for (const s of splices) {
    result = result.slice(0, s.start) + s.value + result.slice(s.end);
  }
  return result;
}
