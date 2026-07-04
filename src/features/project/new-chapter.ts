/**
 * New chapter (§4.6 / QA Fase 1): scaffold a chapter file and splice its
 * \input into documento.tex right after the last chapter, touching only the
 * inserted line — every other byte stays identical (same contract as
 * reorder.ts).
 */

/** Matches an active (non-commented) chapter \input at line start. */
const CHAPTER_INPUT = /^([ \t]*)\\input\{elementos-textuais\/[^}]*\}/;

export function chapterScaffold(title: string, slug: string): string {
  return `\\chapter{${title}}\n\\label{cap:${slug}}\n\n`;
}

/**
 * Inserts `\input{target}` on a new line after the LAST chapter \input,
 * reusing that line's indentation. Commented lines (%\input{...}) never
 * match — the pattern requires the line to start at \input.
 */
export function insertChapterInput(source: string, target: string): string {
  const lines = source.split("\n");
  let lastIndex = -1;
  let indent = "\t";
  for (let i = 0; i < lines.length; i++) {
    const match = CHAPTER_INPUT.exec(lines[i] ?? "");
    if (match) {
      lastIndex = i;
      indent = match[1] ?? "";
    }
  }
  if (lastIndex === -1) {
    throw new Error(
      "Nenhum capítulo (\\input{elementos-textuais/...}) encontrado no documento.tex",
    );
  }
  lines.splice(lastIndex + 1, 0, `${indent}\\input{${target}}`);
  return lines.join("\n");
}
