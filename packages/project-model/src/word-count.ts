/**
 * Prose word count over LaTeX source (QA Fase 1). Approximate by design:
 * strips comments, math, code listings and non-prose macro arguments
 * (\cite, \ref, \label, \includegraphics…), keeps the argument text of
 * styling macros (\textbf{palavra} counts "palavra") and section titles.
 */

/** Macros whose arguments are plumbing, not prose — dropped whole. */
const DROP_ARG_MACROS =
  /\\(?:label|ref|autoref|pageref|eqref|cite\w*|nocite|input|include(?:graphics|pdf)?|bibliography(?:style)?|graphicspath|url|pagestyle|thispagestyle|selectlanguage|usepackage|documentclass|vspace|hspace)\*?(?:\[[^\]\n]*\])*(?:\{[^{}]*\})+/g;

const VERBATIM_ENVS = /\\begin\{(verbatim\*?|lstlisting)\}[\s\S]*?\\end\{\1\}/g;

const MATH_ENVS =
  /\\begin\{(equation\*?|align\*?|alignat\*?|gather\*?|eqnarray\*?|multline\*?|displaymath|math)\}[\s\S]*?\\end\{\1\}/g;

const WORD = /[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu;

export function countLatexWords(source: string): number {
  let s = source;
  // Escaped specials first, so \% below is not mistaken for a comment.
  s = s.replace(/\\[\\%&#$_{}~^ ]/g, " ");
  s = s.replace(/%.*$/gm, " ");
  s = s.replace(VERBATIM_ENVS, " ");
  s = s.replace(MATH_ENVS, " ");
  s = s.replace(/\$\$[\s\S]*?\$\$/g, " ");
  s = s.replace(/\$[^$\n]*\$/g, " ");
  s = s.replace(/\\\[[\s\S]*?\\\]/g, " ");
  s = s.replace(/\\\([\s\S]*?\\\)/g, " ");
  s = s.replace(DROP_ARG_MACROS, " ");
  s = s.replace(/\\(?:begin|end)\{[^}]*\}(?:\[[^\]\n]*\])?/g, " ");
  // Remaining macro names go away; their braced prose stays.
  s = s.replace(/\\[a-zA-Z@]+\*?/g, " ");
  s = s.replace(/[{}[\]]/g, "");
  return s.match(WORD)?.length ?? 0;
}
