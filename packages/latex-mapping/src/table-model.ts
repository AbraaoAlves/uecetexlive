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

/** Half-open [start, end) offset range inside `pre` or `post`. */
export interface TableTextSpan {
  start: number;
  end: number;
}

export interface TableMacroSpan {
  /** Toda a chamada, do `\` ao `}` de fechamento. */
  macro: TableTextSpan;
  /** Só o texto editável de dentro do argumento obrigatório. */
  argument: TableTextSpan;
}

export interface TableModel {
  /** Everything up to and including `\begin{tabular}{spec}`. */
  pre: string;
  /** `\end{tabular}` onward (closing wrappers, \Fonte, \end{table}…). */
  post: string;
  colspec: string;
  segments: TableSegment[];
  /**
   * Onde a legenda editável mora dentro do `pre` — só o texto, nunca o
   * `\label{...}` que costuma vir antes dele. `null` quando a tabela não tem
   * `\Caption`/`\caption`: aí não há lugar seguro para inventar uma.
   */
  captionSpan: TableMacroSpan | null;
  /** O mesmo para a indicação de fonte, dentro do `post`. */
  fonteSpan: TableMacroSpan | null;
}

const RULE_MACRO =
  /\\(?:hline|toprule|midrule|bottomrule|cmidrule|cline|addlinespace|specialrule)/;

/**
 * Traços que marcam **fronteira** de faixa (booktabs), não separador que se
 * repete entre linhas. O `\hline` fica de fora de propósito: ele separa toda
 * linha da seguinte, e é o que as tabelas vindas de PDF usam.
 */
const BOUNDARY_RULE = /\\(?:toprule|midrule|bottomrule|specialrule)/;

/** `\Caption` é a forma da UECE; `\caption` é a do LaTeX. */
const CAPTION_MACROS = ["Caption", "caption"] as const;
const FONTE_MACROS = ["Fonte", "fonte"] as const;

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

const LABEL_MACRO = "\\label{";

/**
 * Onde o texto começa de verdade dentro de `[start, end)`: depois do
 * `\label{...}`, quando ele abre o argumento. Aqui também se conta chave — o
 * mesmo motivo do colspec, e por isso nada de `[^}]*`.
 */
function skipLabel(text: string, start: number, end: number): number {
  const at = start + (/^\s*/.exec(text.slice(start, end))?.[0].length ?? 0);
  if (!text.startsWith(LABEL_MACRO, at)) return start;
  const close = groupEnd(text, at + LABEL_MACRO.length - 1);
  if (close === -1 || close >= end) return start;
  const after = close + 1;
  return after + (/^[ \t]*/.exec(text.slice(after, end))?.[0].length ?? 0);
}

/**
 * Onde uma das macros dadas mora, dentro de `text`, e onde fica o texto
 * editável dela.
 *
 * Dois cuidados: o argumento opcional (`\caption[Resumo]{Legenda}`,
 * `\Fonte[Origem]{Autor}`) é pulado antes do obrigatório, e o `\label{...}`
 * que costuma abrir o argumento fica de fora — quem edita a legenda quer
 * trocar o texto, não perder a âncora das referências cruzadas.
 */
function macroSpan(text: string, macros: readonly string[]): TableMacroSpan | null {
  for (const macro of macros) {
    const token = `\\${macro}`;
    for (let at = text.indexOf(token); at !== -1; at = text.indexOf(token, at + 1)) {
      let cursor = at + token.length;
      if (text[cursor] === "[") {
        const optionalEnd = text.indexOf("]", cursor);
        if (optionalEnd === -1) continue;
        cursor = optionalEnd + 1;
      }
      // Sem `{` logo aqui não é esta macro — `\Fonte` casaria o começo de
      // `\Fontes`, e o nome mais longo tem de seguir adiante.
      if (text[cursor] !== "{") continue;
      const close = groupEnd(text, cursor);
      if (close === -1) continue;
      return {
        macro: { start: at, end: close + 1 },
        argument: { start: skipLabel(text, cursor + 1, close), end: close },
      };
    }
  }
  return null;
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

  const pre = raw.slice(0, bodyStart);
  const post = raw.slice(endIdx);
  const model: TableModel = {
    pre,
    post,
    colspec: begin.colspec,
    segments: parseBody(raw.slice(bodyStart, endIdx)),
    captionSpan: macroSpan(pre, CAPTION_MACROS),
    fonteSpan: macroSpan(post, FONTE_MACROS),
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

/** Segment indices of the row segments, in order. */
function rowSegmentIndices(model: TableModel): number[] {
  const indices: number[] = [];
  model.segments.forEach((segment, index) => {
    if (segment.kind === "row") indices.push(index);
  });
  return indices;
}

/**
 * Linha vazia logo depois de `rowIndex`, com o mesmo recuo e o mesmo `\\` da
 * linha de referência. Ela nasce `edited` — não existe no original, e é a única
 * que a serialização reescreve.
 *
 * Onde ela entra depende do que separa a linha escolhida da vizinha **do lado
 * em que a nova cai**:
 *
 * - `\hline` e afins se repetem entre todas as linhas (é o que as tabelas
 *   vindas de PDF usam), então a nova ganha uma cópia do traço;
 * - `\toprule`/`\midrule`/`\bottomrule` são fronteira de faixa, não separador:
 *   duplicá-los poria a linha nova entre dois traços. A nova entra do lado do
 *   corpo, depois da fronteira, e nada é copiado.
 */
export function insertRow(model: TableModel, rowIndex: number): TableModel {
  const rows = rowSegmentIndices(model);
  const at = rows[rowIndex];
  if (at === undefined) return model;
  const reference = model.segments[at] as TableRowSegment;
  const fresh: TableRowSegment = {
    kind: "row",
    text: "",
    indent: reference.indent,
    cells: Array(Math.max(1, columnCount(model))).fill(""),
    trailer: reference.trailer,
    edited: true,
  };

  const next = rows[rowIndex + 1];
  const previous = rows[rowIndex - 1];
  const run =
    next !== undefined
      ? model.segments.slice(at + 1, next)
      : previous !== undefined
        ? model.segments.slice(previous + 1, at)
        : [];
  const segments = model.segments.slice();
  if (run.some((segment) => BOUNDARY_RULE.test(segment.text))) {
    segments.splice(next ?? at + 1, 0, fresh);
  } else {
    segments.splice(at + 1, 0, ...run.map((segment) => ({ ...segment })), fresh);
  }
  return { ...model, segments };
}

/**
 * Remove a linha e o separador que ela deixaria sobrando — o do lado oposto ao
 * da borda, para nunca levar junto o `\bottomrule` da tabela. Remover a última
 * linha não é permitido: sem linha de conteúdo a tabela deixa de ser grade e
 * volta a aparecer como código.
 *
 * Aqui a fronteira de faixa **vai junto**, ao contrário do que acontece ao
 * inserir: quem sai é a linha de cabeçalho, e sem cabeçalho não há faixa para
 * o `\midrule` fechar. Inserir é o caso oposto — a linha nova precisa cair de
 * um lado ou do outro da fronteira que continua existindo.
 */
export function removeRow(model: TableModel, rowIndex: number): TableModel {
  const rows = rowSegmentIndices(model);
  const at = rows[rowIndex];
  if (at === undefined || rows.length <= 1) return model;
  const next = rows[rowIndex + 1];
  const previous = rows[rowIndex - 1];
  const [from, to] = next !== undefined ? [at, next - 1] : [(previous as number) + 1, at];
  const segments = model.segments.slice();
  segments.splice(from, to - from + 1);
  return { ...model, segments };
}

function replaceArgument(
  text: string,
  span: TableMacroSpan,
  value: string,
): { text: string; span: TableMacroSpan } {
  const delta = value.length - (span.argument.end - span.argument.start);
  return {
    text: text.slice(0, span.argument.start) + value + text.slice(span.argument.end),
    span: {
      macro: { start: span.macro.start, end: span.macro.end + delta },
      argument: {
        start: span.argument.start,
        end: span.argument.end + delta,
      },
    },
  };
}

/** Apaga a macro inteira — e a linha, se ela não tinha mais nada. */
function removeMacro(text: string, span: TableMacroSpan): string {
  const lineStart = text.lastIndexOf("\n", span.macro.start) + 1;
  const lineBreak = text.indexOf("\n", span.macro.end);
  const lineEnd = lineBreak === -1 ? text.length : lineBreak;
  const rest =
    text.slice(lineStart, span.macro.start) + text.slice(span.macro.end, lineEnd);
  if (rest.trim() === "") {
    return (
      text.slice(0, lineStart) + text.slice(lineBreak === -1 ? lineEnd : lineEnd + 1)
    );
  }
  return text.slice(0, span.macro.start) + text.slice(span.macro.end);
}

/** Texto da legenda, ou `null` quando a tabela não tem `\Caption`/`\caption`. */
export function tableCaption(model: TableModel): string | null {
  const span = model.captionSpan;
  return span ? model.pre.slice(span.argument.start, span.argument.end) : null;
}

/** Texto da indicação de fonte, ou `null` quando não há `\Fonte`. */
export function tableFonte(model: TableModel): string | null {
  const span = model.fonteSpan;
  return span ? model.post.slice(span.argument.start, span.argument.end) : null;
}

/**
 * Legenda vazia **não** apaga a macro: o `\label` mora dentro dela, e levá-lo
 * junto quebraria toda referência cruzada que aponta para esta tabela.
 */
export function editCaption(model: TableModel, value: string): TableModel {
  const span = model.captionSpan;
  if (!span) return model;
  const next = replaceArgument(model.pre, span, value);
  return { ...model, pre: next.text, captionSpan: next.span };
}

/**
 * Fonte apagada some da saída: `\Fonte{}` imprime a linha "Fonte:" em branco no
 * PDF — o mesmo cuidado que a figura já tinha.
 */
export function editFonte(model: TableModel, value: string): TableModel {
  const span = model.fonteSpan;
  if (!span) return model;
  if (value.trim() === "") {
    return { ...model, post: removeMacro(model.post, span), fonteSpan: null };
  }
  const next = replaceArgument(model.post, span, value);
  return { ...model, post: next.text, fonteSpan: next.span };
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
