/**
 * Work metadata (§F2) — pure read/write of the uecetex2 preamble macros in
 * documento.tex (\titulo, \autor, \trabalhoacademico, banca, …).
 *
 * Same discipline as include-graph.ts (unified-latex, so comments never
 * count) + reorder.ts (surgical offset splices). Invariant mirror of the
 * parser's Invariant #1: applying the extracted values back unchanged must
 * reproduce the source byte-for-byte.
 */
import type * as Ast from "@unified-latex/unified-latex-types";
import { parse } from "@unified-latex/unified-latex-util-parse";
import { sliceArgs } from "@/features/latex-mapping/slice-args";
import { walk } from "./include-graph";

export type WorkType = "tccgraduacao" | "tccespecializacao" | "dissertacao" | "tese";
export const WORK_TYPES: readonly WorkType[] = [
  "tccgraduacao",
  "tccespecializacao",
  "dissertacao",
  "tese",
];

const BANCA_SLOTS = ["dois", "tres", "quatro", "cinco", "seis"] as const;

/** Every uecetex2/abnTeX2 metadata setter (all take one mandatory group). */
export const METADATA_MACROS: readonly string[] = [
  "trabalhoacademico",
  "ehqualificacao",
  "ies",
  "iessigla",
  "centro",
  "graduacaoem",
  "habilitacao",
  "especializacaoem",
  "programamestrado",
  "nomedomestrado",
  "mestreem",
  "areadeconcentracaomestrado",
  "programadoutorado",
  "nomedodoutorado",
  "doutorem",
  "areadeconcentracaodoutorado",
  "autor",
  "titulo",
  "data",
  "local",
  "dataaprovacao",
  "orientador",
  "orientadories",
  "orientadorcentro",
  "orientadorfeminino",
  "coorientador",
  "coorientadories",
  "coorientadorcentro",
  "coorientadorfeminino",
  ...BANCA_SLOTS.flatMap((slot) => [
    `membrodabanca${slot}`,
    `membrodabanca${slot}ies`,
    `membrodabanca${slot}centro`,
  ]),
];

/** abntex2.cls gives these a leading [label] arg — preserve it untouched. */
const OPT_ARG_MACROS = new Set(["orientador", "coorientador"]);

/** Placeholder \titulo shipped by the template (drives the "pending" badge). */
export const TEMPLATE_PLACEHOLDER_TITLE = "Título do Trabalho";

export interface MetadataField {
  macro: string;
  /** Group content exactly as written in the source. */
  value: string;
  /** Offset of the first byte inside the braces. */
  start: number;
  /** Offset of the closing brace (one past the last content byte). */
  end: number;
}

function macroNameEnd(macro: Ast.Macro): number | null {
  const pos = (macro as { position?: { end: { offset: number } } }).position;
  return pos ? pos.end.offset : null;
}

/**
 * Extract every catalog macro from the preamble (before \begin{document}).
 * LaTeX \def semantics: the last non-commented occurrence wins.
 */
export function extractMetadata(source: string): Map<string, MetadataField> {
  const out = new Map<string, MetadataField>();
  const catalog = new Set(METADATA_MACROS);
  const docStart = source.indexOf("\\begin{document}");
  const preambleEnd = docStart === -1 ? source.length : docStart;

  let ast: Ast.Root;
  try {
    ast = parse(source);
  } catch {
    return out;
  }

  walk(ast.content, (macro) => {
    const name = macro.content;
    if (!catalog.has(name)) return;
    const nameEnd = macroNameEnd(macro);
    if (nameEnd === null || nameEnd >= preambleEnd) return;
    // Tolerate `\titulo {…}` spacing without crossing a line break.
    let from = nameEnd;
    while (source[from] === " " || source[from] === "\t") from++;
    const slices = sliceArgs(source, from, OPT_ARG_MACROS.has(name));
    if (!slices || slices.mandatory === null) return;
    const end = slices.end - 1; // closing brace
    out.set(name, {
      macro: name,
      value: slices.mandatory,
      start: end - slices.mandatory.length,
      end,
    });
  });

  return out;
}

/**
 * Replace the group content of each updated macro, leaving every other byte
 * intact. Values are written verbatim — free-text input must go through
 * escapeMetadataValue first; enum values (\trabalhoacademico, sim|nao) as-is.
 * Macros absent from the source are skipped (graceful degradation).
 */
export function applyMetadata(
  source: string,
  updates: ReadonlyMap<string, string>,
): string {
  const fields = extractMetadata(source);
  const splices: Array<{ start: number; end: number; value: string }> = [];
  for (const [macro, value] of updates) {
    const field = fields.get(macro);
    if (!field || field.value === value) continue;
    splices.push({ start: field.start, end: field.end, value });
  }
  // Descending start order: earlier offsets stay valid while splicing.
  splices.sort((a, b) => b.start - a.start);
  let result = source;
  for (const s of splices) {
    result = result.slice(0, s.start) + s.value + result.slice(s.end);
  }
  return result;
}

const LATEX_ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  "#": "\\#",
  _: "\\_",
  $: "\\$",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

/** Escape LaTeX-special characters in free-text form input (single pass). */
export function escapeMetadataValue(raw: string): string {
  return raw.replace(/[\\&%#_${}~^]/g, (ch) => LATEX_ESCAPES[ch] ?? ch);
}

/** Current \trabalhoacademico value, if recognized. */
export function workTypeOf(fields: ReadonlyMap<string, MetadataField>): WorkType | null {
  const value = fields.get("trabalhoacademico")?.value.trim();
  return (WORK_TYPES as readonly string[]).includes(value ?? "")
    ? (value as WorkType)
    : null;
}
