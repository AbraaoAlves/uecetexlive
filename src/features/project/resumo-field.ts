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

/** Rótulo textual das palavras-chave, nas duas línguas que o modelo usa. */
const KEYWORD_LABEL = /(^|[\s])(Palavras-chave|Keywords)[ \t]*:[ \t]*/gi;

/** Offset do primeiro `%` não escapado, ou o fim do texto. */
function findComment(text: string): number {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === "%") return i;
  }
  return text.length;
}

/** O offset cai depois de um `%` não escapado na mesma linha? */
function isInsideComment(source: string, offset: number): boolean {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  const commentAt = findComment(source.slice(lineStart, offset));
  return lineStart + commentAt < offset;
}

/** Chaves LaTeX pareadas, ignorando as escapadas (`\{`, `\}`). */
function hasBalancedBraces(text: string): boolean {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") {
      i++; // o próximo caractere está escapado
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}" && --depth < 0) {
      return false;
    }
  }
  return depth === 0;
}

/**
 * Reconhece "Palavras-chave:"/"Keywords:" escrito como texto corrido no fim do
 * arquivo — a forma que sai do caminho PDF→LaTeX — e devolve a forma canônica,
 * com a macro que o wizard procura. `null` quando não há nada a fazer.
 *
 * O rótulo procurado é a ÚLTIMA ocorrência: o texto do resumo pode citar a
 * expressão antes (o próprio modelo cita, ao explicar a norma).
 */
export function normalizeResumoSource(
  source: string,
  keywordMacro: ResumoKeywordMacro,
): string | null {
  // Já canônico: a macro manda, mesmo que o rótulo apareça no corpo.
  if (extractResumoField(source, keywordMacro) !== null) return null;

  let last: RegExpExecArray | null = null;
  KEYWORD_LABEL.lastIndex = 0;
  for (
    let match = KEYWORD_LABEL.exec(source);
    match !== null;
    match = KEYWORD_LABEL.exec(source)
  ) {
    // Um rótulo dentro de comentário é exemplo, não conteúdo. A checagem é na
    // posição do rótulo: o grupo 1 do regex pode ser a própria quebra de linha
    // que encerra um comentário anterior.
    if (!isInsideComment(source, match.index + (match[1]?.length ?? 0))) last = match;
  }
  if (!last) return null;

  const body = source.slice(0, last.index).trimEnd();
  const tail = source.slice(last.index + last[0].length);
  // O que vier depois de um comentário fica fora da macro: engolir o `%` faria
  // o `}` cair na linha comentada e o TeX perderia o fim do grupo.
  // Idem para um parágrafo novo: só a linha lógica do rótulo é palavra-chave.
  const commentAt = findComment(tail);
  const paragraphAt = tail.search(/\n[ \t]*\n/);
  const cutAt = paragraphAt === -1 ? commentAt : Math.min(commentAt, paragraphAt);
  const keywords = tail.slice(0, cutAt).trim();
  const trailing = tail.slice(cutAt).trim();
  // Chaves desbalanceadas viram um grupo LaTeX quebrado — melhor deixar o
  // arquivo como está e o wizard avisar do que estragar o documento.
  if (keywords === "" || !hasBalancedBraces(keywords)) return null;
  const suffix = trailing === "" ? "" : `${trailing}\n`;
  return `${body}\n\n\\${keywordMacro}{${keywords}}\n${suffix}`;
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
