/**
 * Visual table editing (QA Fase 2). A `latexTable` node keeps its original
 * source in `rawSource`; this module decomposes the inner `tabular` into an
 * editable grid and rebuilds it, touching ONLY the cells the student edited.
 *
 * Fidelity contract (mirror of the parser's Invariant #1):
 *   serializeTable(parseTable(raw)) === raw   // byte-exact, nothing edited
 * Untouched rows re-emit their original line verbatim; a rule line, blank
 * line, caption or \Fonte wrapper is opaque and never rewritten. Only a row
 * whose `edited` flag is set is re-serialized (cells joined with " & ").
 */

export interface TableRowSegment {
  kind: "row";
  /** Original source line — emitted verbatim until edited. */
  text: string;
  indent: string;
  cells: string[];
  /** Trailing `\\` plus surrounding whitespace. */
  trailer: string;
  edited: boolean;
}

export interface TableOpaqueSegment {
  kind: "opaque";
  text: string;
}

export type TableSegment = TableRowSegment | TableOpaqueSegment;

export interface TableModel {
  /** Everything up to and including `\begin{tabular}{spec}`. */
  pre: string;
  /** `\end{tabular}` onward (closing wrappers, \Fonte, \end{table}…). */
  post: string;
  colspec: string;
  segments: TableSegment[];
}

const RULE_MACRO =
  /\\(?:hline|toprule|midrule|bottomrule|cmidrule|cline|addlinespace|specialrule)/;

/** Split a row on unescaped `&`. */
function splitCells(content: string): string[] {
  return content.split(/(?<!\\)&/).map((c) => c.trim());
}

function parseBody(body: string): TableSegment[] {
  const segments: TableSegment[] = [];
  for (const line of body.split("\n")) {
    if (line.trim() === "") {
      segments.push({ kind: "opaque", text: line });
      continue;
    }
    // A content row ends with `\\` and carries no rule/structural macro.
    const rowMatch = line.match(/^([ \t]*)([\s\S]*?)([ \t]*\\\\[ \t]*)$/);
    if (rowMatch && !RULE_MACRO.test(line) && !/\\(?:begin|end)\{/.test(line)) {
      segments.push({
        kind: "row",
        text: line,
        indent: rowMatch[1] ?? "",
        cells: splitCells(rowMatch[2] ?? ""),
        trailer: rowMatch[3] ?? "",
        edited: false,
      });
      continue;
    }
    segments.push({ kind: "opaque", text: line });
  }
  return segments;
}

const TABULAR_BEGIN = "\\begin{tabular}";

/**
 * Index of the `}` that closes the group opened at `open`, or -1. A backslash
 * escapes whatever follows it, so `\{`, `\}` and the row break `\\` never
 * count as delimiters.
 */
function groupEnd(raw: string, open: number): number {
  let depth = 0;
  for (let index = open; index < raw.length; index++) {
    const char = raw[index];
    if (char === "\\") {
      index++;
      continue;
    }
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * Localiza o `tabular` e lê o colspec **contando chaves**.
 *
 * A leitura anterior era uma regex que proibia chave dentro do colspec, e o
 * importador de PDF escreve uma coluna `p{…\dimexpr…}` por coluna medida —
 * então nenhuma tabela vinda de PDF casava, `parseTable` devolvia `null` e a
 * tabela aparecia como código na tela em vez de grade. Parar no primeiro `}`
 * também não serve: devolveria um colspec truncado.
 */
function findTabular(raw: string): { bodyStart: number; colspec: string } | null {
  const begin = raw.indexOf(TABULAR_BEGIN);
  if (begin === -1) return null;
  let cursor = begin + TABULAR_BEGIN.length;
  // Argumento opcional de posicionamento: `\begin{tabular}[t]{ll}`.
  if (raw[cursor] === "[") {
    const close = raw.indexOf("]", cursor);
    if (close === -1) return null;
    cursor = close + 1;
  }
  if (raw[cursor] !== "{") return null;
  const close = groupEnd(raw, cursor);
  if (close === -1) return null;
  return { bodyStart: close + 1, colspec: raw.slice(cursor + 1, close) };
}

/**
 * Parse a `latexTable` rawSource into an editable model, or null when the
 * source has no single flat `tabular` (nested tabulars, missing env → keep
 * the read-only projection).
 */
export function parseTable(raw: string): TableModel | null {
  const begin = findTabular(raw);
  if (!begin) return null;
  const bodyStart = begin.bodyStart;
  const endIdx = raw.indexOf("\\end{tabular}", bodyStart);
  if (endIdx === -1) return null;
  // Reject nested tabulars — the grid model only handles a single flat one.
  const nested = raw.indexOf("\\begin{tabular}", bodyStart);
  if (nested !== -1 && nested < endIdx) return null;

  const model: TableModel = {
    pre: raw.slice(0, bodyStart),
    post: raw.slice(endIdx),
    colspec: begin.colspec,
    segments: parseBody(raw.slice(bodyStart, endIdx)),
  };
  // A tabular with no editable content row is not worth a grid.
  if (!model.segments.some((s) => s.kind === "row")) return null;
  return model;
}

export function serializeTable(model: TableModel): string {
  const body = model.segments
    .map((seg) =>
      seg.kind === "opaque"
        ? seg.text
        : seg.edited
          ? `${seg.indent}${seg.cells.join(" & ")}${seg.trailer}`
          : seg.text,
    )
    .join("\n");
  return model.pre + body + model.post;
}

/** Row segments in order, for grid rendering. */
export function tableRows(model: TableModel): TableRowSegment[] {
  return model.segments.filter((s): s is TableRowSegment => s.kind === "row");
}

export function tableGrid(model: TableModel): string[][] {
  return tableRows(model).map((r) => r.cells);
}

/** Column count = widest row. */
export function columnCount(model: TableModel): number {
  return tableRows(model).reduce((max, r) => Math.max(max, r.cells.length), 0);
}

/**
 * Return a new model with one cell replaced. `rowIndex` counts row segments
 * only (rules/blank lines are skipped); out-of-range indices are no-ops.
 */
export function editCell(
  model: TableModel,
  rowIndex: number,
  colIndex: number,
  value: string,
): TableModel {
  let seen = -1;
  const segments = model.segments.map((seg) => {
    if (seg.kind !== "row") return seg;
    seen += 1;
    if (seen !== rowIndex) return seg;
    if (colIndex < 0 || colIndex >= seg.cells.length) return seg;
    const cells = seg.cells.slice();
    cells[colIndex] = value;
    return { ...seg, cells, edited: true };
  });
  return { ...model, segments };
}
