/**
 * Stage 2 — IR -> semantic tree classifier.
 *
 * Pure rules keyed to the ueceTeX2 signatures documented in
 * ASSINATURAS.md. Deterministic by construction: no clock, no
 * randomness, stable iteration order, fixed tolerances.
 *
 * Signature constants (bp, top-left origin, A4):
 *   LEFT      = 84.95   text-block left edge (3cm margin)
 *   INDENT    = 141.5   \parindent 2cm — paragraph start
 *   QUOTE_X   ≈ 197–204 citação longa (4cm)
 *   size 12 nominal is quantized by mupdf to 11 or 12 — hence ±1.
 */
import type { DocumentIR, OutlineNode, PageIR, TextLine } from "./ir.js";
import type {
  BibEntry,
  FrontMatter,
  BodyNode,
  FootnoteEntry,
  HeadingNode,
  ListNode,
  PretextualSection,
  SemanticDoc,
} from "./semantic.js";

// ---------------------------------------------------------------------------
// Tunables (all in bp; fixed — changing them is a versioned decision)
// ---------------------------------------------------------------------------
const LEFT = 84.95;
const INDENT = 141.5;
const TOL_X = 4;
const QUOTE_X_MIN = 185;
const QUOTE_X_MAX = 215;
const ALPHA_ITEM_X: [number, number] = [138, 152];
/**
 * Recuo pendente de continuação de item, medido em relação ao x0 do próprio
 * item — não em coordenada absoluta. As duas geometrias observadas:
 *
 *   alíneas abnTeX2   item ≈143  →  continuação ≈159   (+16)
 *   itemize 1º nível  item ≈104  →  continuação ≈114   (+10)
 *
 * Uma janela absoluta (era [150,178]) só cobria a primeira e perdia toda
 * continuação de itemize. O sinal invariante é o recuo pendente positivo.
 */
const ITEM_HANG_MIN = 5;
const ITEM_HANG_MAX = 30;
/** Faixa em que um marcador de item pode aparecer (itemize a alíneas). */
const ITEM_X: [number, number] = [88, 180];
const CENTER_TOL = 32;
const FOLIO_Y_MAX = 72;
const HEADING_GAP_MIN = 30; // baseline gap that isolates a subsection
const BIB_ENTRY_GAP = 19; // internal leading ~14.5 vs inter-entry ~24

const MATH_FONTS = /^(CM(R|MI|SY|EX)\d+|StandardSymL)/;
const BODY_FONT = /^NimbusRomNo9L/;
/** Rótulo das palavras-chave — abre parágrafo próprio mesmo sem recuo. */
const KEYWORD_LABEL = /^(Palavras-chave|Keywords)\s*:/;

const PRETEXTUAL_TITLES = new Set([
  "ERRATA",
  "AGRADECIMENTOS",
  "RESUMO",
  "ABSTRACT",
  "DEDICATÓRIA",
  "EPÍGRAFE",
]);
const SKIP_TITLES_PREFIX = ["LISTA DE", "SUMÁRIO"];
const POSTTEXTUAL_PREFIX = ["GLOSSÁRIO", "APÊNDICE", "ANEXO", "ÍNDICE"];

// ---------------------------------------------------------------------------
// Line utilities
// ---------------------------------------------------------------------------

/** Join spans, restoring inter-span spaces from geometry (gap > 1.5bp). */
export function lineText(line: TextLine): string {
  let out = "";
  let prevX1 = -Infinity;
  for (const s of line.spans) {
    if (out && s.bbox.x0 - prevX1 > 1.5 && !out.endsWith(" ") && !s.text.startsWith(" ")) out += " ";
    out += s.text;
    prevX1 = s.bbox.x1;
  }
  return out.replace(/\s+/g, " ").trim();
}

interface Line {
  text: string;
  x0: number;
  x1: number;
  y0: number;
  baseline: number;
  size: number;
  bold: boolean;
  italic: boolean;
  font: string;
  hasMath: boolean;
  /** Bold sub-runs (span level) — abnt-emphasize=bf titles in bib entries. */
  boldRuns: string[];
  /** listings signature: NR-Regu line-number span (≤8pt) + non-Nimbus/CM code spans. */
  codeLike: boolean;
  page: number;
  pageWidth: number;
  consumed: boolean;
  /** Set by markLists(): part of a real list environment, and in which role. */
  listRole?: "item" | "cont";
  /**
   * Fragmentos da linha com o x de início, para atribuir coluna de tabela em
   * nível de span: o mupdf às vezes entrega a linha de cabeçalho inteira como
   * uma única linha ("Indicador Khan Academy URI Online Judge"), e atribuir a
   * linha toda a uma coluna colapsava o cabeçalho.
   */
  parts: { text: string; x0: number }[];
}

function flattenPage(p: PageIR): Line[] {
  const lines: Line[] = [];
  for (const b of p.blocks) {
    for (const l of b.lines) {
      const first = l.spans[0];
      if (!first) continue;
      const t = lineText(l);
      if (!t) continue;
      const rest = l.spans.slice(1);
      const codeLike =
        /^\d+$/.test(first.text.trim()) &&
        first.size <= 8 &&
        rest.length > 0 &&
        rest.every((s) => !BODY_FONT.test(s.font) && !MATH_FONTS.test(s.font));
      lines.push({
        text: t,
        x0: l.bbox.x0,
        x1: l.bbox.x1,
        y0: l.bbox.y0,
        baseline: first.baseline,
        size: Math.max(...l.spans.map((s) => s.size)),
        bold: l.spans.every((s) => s.bold || !/[A-Za-zÀ-ú0-9]/.test(s.text)),
        italic: first.italic,
        font: first.font,
        hasMath: l.spans.some((s) => MATH_FONTS.test(s.font)),
        boldRuns: l.spans.filter((s) => s.bold && /[A-Za-zÀ-ú]/.test(s.text)).map((s) => s.text.trim()),
        codeLike,
        page: p.index,
        pageWidth: p.width,
        consumed: false,
        parts: l.spans.map((sp) => ({ text: sp.text.trim(), x0: sp.bbox.x0 })).filter((sp) => sp.text),
      });
    }
  }
  lines.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  return lines;
}

const ITEM_MARKER = /^(\([a-z]\)|[a-z]\)|\d{1,2}\.|[•◦‣]) /;

/**
 * Marca as linhas que realmente pertencem a um ambiente de lista.
 *
 * O problema: um parágrafo que o autor começou com "1. " ou "(a) " abre em
 * x0 = \parindent = 141,5, e uma alínea abnTeX2 abre em ≈143 — 1,5bp de
 * diferença, dentro de qualquer tolerância honesta. Testar o x0 do item
 * isoladamente não separa os dois casos.
 *
 * O invariante que separa é o RECUO PENDENTE do bloco inteiro: numa lista de
 * verdade a continuação do item recua para dentro (alíneas 143→159, itemize
 * 104→114); num parágrafo enumerado a continuação volta para a margem
 * (141→84). Então a decisão é tomada por RUN de itens, não por linha:
 *
 *   aceita como lista  <=>  o run tem alguma continuação pendente
 *                           OU o x0 do item está claramente fora do \parindent
 *
 * A segunda condição cobre listas de itens todos de uma linha (itemize a 104,
 * bullets a 147), que não têm continuação nenhuma para provar o recuo.
 */
function markLists(lines: Line[], carryItemX0?: number): void {
  const PARINDENT_BAND = 2.5;
  // Uma lista pode atravessar a quebra de página: as primeiras linhas da
  // página nova são continuação do último item da página anterior.
  if (carryItemX0 !== undefined) {
    for (const l of lines) {
      if (l.consumed) continue;
      const hang = l.x0 - carryItemX0;
      if (hang >= ITEM_HANG_MIN && hang <= ITEM_HANG_MAX && !ITEM_MARKER.test(l.text)) l.listRole = "cont";
      else break;
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const first = lines[i];
    if (!first || first.consumed || first.listRole || !ITEM_MARKER.test(first.text)) continue;
    if (!(first.x0 >= ITEM_X[0] && first.x0 <= ITEM_X[1])) continue;

    // Estende o run: itens no mesmo x0 + continuações com recuo pendente.
    const itemX0 = first.x0;
    const items: Line[] = [];
    const conts: Line[] = [];
    let j = i;
    for (; j < lines.length; j++) {
      const l = lines[j];
      if (!l || l.consumed) break;
      const isItem = Math.abs(l.x0 - itemX0) <= TOL_X && ITEM_MARKER.test(l.text);
      const hang = l.x0 - itemX0;
      const isCont = items.length > 0 && hang >= ITEM_HANG_MIN && hang <= ITEM_HANG_MAX;
      if (isItem) items.push(l);
      else if (isCont) conts.push(l);
      else break;
    }
    if (!items.length) continue;

    const offParindent = Math.abs(itemX0 - INDENT) > PARINDENT_BAND;
    if (conts.length || offParindent) {
      for (const l of items) l.listRole = "item";
      for (const l of conts) l.listRole = "cont";
    }
    i = j - 1;
  }
}

const near = (v: number, target: number, tol = TOL_X) => Math.abs(v - target) <= tol;
const inRange = (v: number, [lo, hi]: [number, number]) => v >= lo && v <= hi;
const isCentered = (l: Line) => Math.abs((l.x0 + l.x1) / 2 - l.pageWidth / 2) <= CENTER_TOL;
const isUpper = (t: string) => /[A-ZÀ-Ú]/.test(t) && t === t.toLocaleUpperCase("pt-BR");
const isBodySize = (l: Line) => l.size >= 11 && l.size <= 12;
const isReducedSize = (l: Line) => l.size >= 9 && l.size <= 10;

/**
 * ABNT dot-leader lines in Sumário / Listas.
 * Threshold is 2, not 4: entries with long titles leave room for only a
 * couple of leader dots, and those were leaking into the body as text.
 */
const isLeaderLine = (t: string) => /(\. ){2,}\.?/.test(t);

/**
 * Sumário / Lista de ilustrações page.
 *
 * Needed because a multi-line ToC entry has NO leader on its first line, so
 * that line is indistinguishable from a real heading: bold, uppercase, at the
 * left margin, prefixed by the chapter number. Page-level context is what
 * disambiguates — a real chapter opener never shares a page with a pile of
 * leader lines.
 */
const TOC_LEADER_MIN = 4;
const isTocPage = (lines: Line[]) => lines.filter((l) => isLeaderLine(l.text)).length >= TOC_LEADER_MIN;

/** Join wrapped lines, resolving end-of-line hyphenation (pt-BR safe rule). */
function joinWrapped(parts: string[]): string {
  let out = "";
  for (const part of parts) {
    if (!out) {
      out = part;
      continue;
    }
    if (/[a-zà-ú]-$/.test(out) && /^[a-zà-ú]/.test(part)) out = out.slice(0, -1) + part;
    else out += " " + part;
  }
  return out.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Heading detection
// ---------------------------------------------------------------------------

/**
 * Um título de capítulo que ocupa duas linhas chega partido e hifenizado
 * ("…GUIA PRÁTICO DE IMPLEMEN-" / "TAÇÃO"). O outline do PDF (bookmarks do
 * hyperref) carrega o título íntegro, então serve de gabarito para reparo.
 *
 * O casamento é pelo prefixo canônico: o outline vem em caixa mista
 * ("Produto Tecnológico-Pedagógico: Guia Prático de Implementação"), o
 * heading em maiúsculas, e o corte pode cair no meio de uma palavra.
 */
function buildOutlineIndex(nodes: OutlineNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    out.push(n.title);
    buildOutlineIndex(n.children, out);
  }
  return out;
}

const canonTitle = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/** Devolve o título íntegro do outline que começa com o fragmento dado. */
function repairTitle(fragment: string, outlineTitles: string[]): string {
  const frag = canonTitle(fragment.replace(/-$/, ""));
  if (frag.length < 8) return fragment;
  const hits = outlineTitles.filter((t) => canonTitle(t).startsWith(frag));
  const hit = hits[0];
  // Só repara quando o gabarito é único e realmente mais longo.
  if (hits.length !== 1 || !hit || canonTitle(hit).length <= frag.length) return fragment;
  return hit.toLocaleUpperCase("pt-BR");
}

function matchHeading(l: Line, gapBefore: number): HeadingNode | null {
  const t = l.text;
  if (!isBodySize(l)) return null;

  // chapter: "N TITLE" — bold, uppercase, at left margin
  let m = /^(\d+) ([A-ZÀ-Ú].+)$/.exec(t);
  if (m && l.bold && near(l.x0, LEFT) && isUpper(m[2] ?? "")) {
    return { kind: "heading", level: "chapter", numbered: true, number: m[1] ?? "", title: m[2] ?? "", page: l.page };
  }
  // subsubsection: "N.N.N.N Title" (per .sty: italic — accept any weight)
  m = /^(\d+\.\d+\.\d+\.\d+)\.? (.+)$/.exec(t);
  if (m && near(l.x0, LEFT) && gapBefore >= HEADING_GAP_MIN) {
    return { kind: "heading", level: "subsubsection", numbered: true, number: m[1] ?? "", title: m[2] ?? "", page: l.page };
  }
  // subsection: "N.N.N Title" — REGULAR weight (\normalfont cancels \bfseries)
  m = /^(\d+\.\d+\.\d+)\.? (.+)$/.exec(t);
  if (m && near(l.x0, LEFT) && gapBefore >= HEADING_GAP_MIN) {
    return { kind: "heading", level: "subsection", numbered: true, number: m[1] ?? "", title: m[2] ?? "", page: l.page };
  }
  // section: "N.N Title" — bold, mixed case
  m = /^(\d+\.\d+)\.? (.+)$/.exec(t);
  if (m && l.bold && near(l.x0, LEFT)) {
    return { kind: "heading", level: "section", numbered: true, number: m[1] ?? "", title: m[2] ?? "", page: l.page };
  }
  return null;
}

/** Unnumbered chapter (RESUMO, REFERÊNCIAS, GLOSSÁRIO, APÊNDICE A — …). */
function matchUnnumberedChapter(l: Line): string | null {
  if (!l.bold || !isBodySize(l) || !isUpper(l.text)) return null;
  const t = l.text.replace(/\s+/g, " ").trim();
  // APÊNDICE A – …, ANEXO B – … are left-aligned unnumbered chapters
  if (/^(APÊNDICE|ANEXO) [A-Z] ?[–—-]/.test(t) && near(l.x0, LEFT)) return t;
  if (!isCentered(l)) return null;
  if (PRETEXTUAL_TITLES.has(t)) return t;
  if (t === "REFERÊNCIAS") return t;
  if (SKIP_TITLES_PREFIX.some((p) => t.startsWith(p))) return t;
  if (POSTTEXTUAL_PREFIX.some((p) => t.startsWith(p))) return t;
  return null;
}

// ---------------------------------------------------------------------------
// Page-scoped strippers
// ---------------------------------------------------------------------------

function stripFolio(lines: Line[]): void {
  for (const l of lines) {
    if (l.y0 <= FOLIO_Y_MAX && /^\d{1,3}$/.test(l.text) && l.x0 > l.pageWidth * 0.7 && isReducedSize(l)) {
      l.consumed = true;
      return;
    }
  }
}

function extractFootnotes(lines: Line[], out: FootnoteEntry[]): void {
  // Footnote block: bottom zone, reduced size, opened by a tiny (≤8pt)
  // superscript digit at the left margin.
  const starts = lines.filter(
    (l) => !l.consumed && l.y0 > 640 && l.size <= 8 && /^\d{1,2}$/.test(l.text) && near(l.x0, LEFT, 6),
  );
  if (!starts.length) return;
  const zoneTop = Math.min(...starts.map((l) => l.y0));
  const zone = lines.filter((l) => !l.consumed && l.y0 >= zoneTop - 3 && l.size <= 10);
  let current: { marker: string; parts: string[]; page: number } | null = null;
  for (const l of zone) {
    l.consumed = true;
    if (l.size <= 8 && /^\d{1,2}$/.test(l.text)) {
      if (current) out.push({ marker: current.marker, text: joinWrapped(current.parts), page: current.page });
      current = { marker: l.text, parts: [], page: l.page };
    } else if (current) {
      current.parts.push(l.text);
    }
  }
  if (current) out.push({ marker: current.marker, text: joinWrapped(current.parts), page: current.page });
}

// ---------------------------------------------------------------------------
// Floats
// ---------------------------------------------------------------------------

const CAPTION_RE = /^(Figura|Tabela|Quadro) (\d+) [–—-] (.*)$/;

function extractFloats(lines: Line[], page: PageIR, pending: PendingNode[]): void {
  for (const [i, l] of lines.entries()) {
    if (l.consumed || !l.bold) continue;
    const m = CAPTION_RE.exec(l.text);
    if (!m) continue;

    l.consumed = true;
    const captionParts = [m[3] ?? ""];
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (!next || next.consumed || !next.bold) break;
      if (next.x0 <= LEFT + 25 || CAPTION_RE.test(next.text)) break;
      captionParts.push(next.text);
      next.consumed = true;
    }
    const caption = joinWrapped(captionParts);

    // Float body spans from the caption down to the "Fonte:" line.
    const fonteLine = lines.find((x) => !x.consumed && x.y0 > l.y0 && isReducedSize(x) && /^Fonte ?:/.test(x.text));
    const yTop = l.y0;
    const yBottom = fonteLine ? fonteLine.y0 + 14 : l.y0 + 320;
    const source = fonteLine?.text.replace(/^Fonte ?: ?/, "");
    if (fonteLine) {
      fonteLine.consumed = true;
      // Apparatus continuations: "Nota:" + wrapped reduced-size lines below Fonte.
      for (const x of lines) {
        if (!x.consumed && x.y0 > fonteLine.y0 && x.y0 < fonteLine.y0 + 60 && isReducedSize(x)) x.consumed = true;
      }
    }

    if (m[1] === "Figura") {
      const imgs = page.images.filter((im) => im.bbox.y0 >= yTop - 6 && im.bbox.y0 <= yBottom);
      pending.push({ y0: l.y0, node: {
        kind: "figure",
        number: Number(m[2]),
        caption,
        source,
        imageFiles: [...new Set(imgs.map((im) => im.file ?? `img-${im.sha256.slice(0, 12)}.png`))],
        page: l.page,
      } });
    } else {
      // Table region: prefer booktabs heavy rules (th≈0.94) below the caption.
      const heavy = page.vectors.filter(
        (v) => v.orientation === "horizontal" && v.thickness >= 0.85 && v.bbox.y0 > yTop && v.bbox.y0 < yBottom + 60,
      );
      const top = heavy.length ? Math.min(...heavy.map((v) => v.bbox.y0)) : yTop;
      const bottom = heavy.length ? Math.max(...heavy.map((v) => v.bbox.y1)) : yBottom;
      const cellLines = lines.filter((x) => !x.consumed && x.y0 >= top - 2 && x.y0 <= bottom + 2);
      // Todas as réguas da região, não só as booktabs pesadas: o quadro do
      // documento real é traçado com 0,4bp e delimita as linhas lógicas.
      const ruleYs = [
        ...new Set(
          page.vectors
            .filter((v) => v.orientation === "horizontal" && v.thickness >= 0.3 && v.bbox.y0 >= top - 4 && v.bbox.y0 <= bottom + 4)
            .map((v) => v.bbox.y0),
        ),
      ].sort((a, b) => a - b);
      const { rows, colWidths } = clusterRows(cellLines, ruleYs);
      for (const x of cellLines) x.consumed = true;
      pending.push({ y0: l.y0, node: {
        kind: "table",
        label: m[1] as "Tabela" | "Quadro",
        number: Number(m[2]),
        caption,
        source,
        rows,
        colWidths,
        page: l.page,
      } });
    }
  }
}

/** Distância mínima entre inícios de coluna distintos. */
const COL_GAP_MIN = 20;

/**
 * Reconstrói linhas LÓGICAS da tabela.
 *
 * Agrupar por baseline transforma cada linha visual em linha da tabela: uma
 * célula que quebra em 8 linhas produzia 8 "linhas" de tabela — o Quadro 1 do
 * documento real saía com 49 no lugar de 6.
 *
 * As réguas horizontais são a fronteira real das linhas lógicas: 7 réguas
 * delimitam 6 faixas, e dentro de cada faixa as linhas visuais se agrupam por
 * coluna (x0) e se juntam com de-hifenização. Sem réguas suficientes cai no
 * agrupamento por baseline, que é o melhor palpite disponível.
 */
function clusterRows(cellLines: Line[], ruleYs: number[] = []): { rows: string[][]; colWidths?: number[] } {
  const bands: [number, number][] = [];
  for (let i = 0; i + 1 < ruleYs.length; i++) bands.push([ruleYs[i] ?? 0, ruleYs[i + 1] ?? 0]);

  if (bands.length >= 2) {
    // Colunas: início de coluna é um x0 distante > COL_GAP_MIN do anterior.
    const xs = [...new Set(cellLines.map((l) => l.x0))].sort((a, b) => a - b);
    const cols: number[] = [];
    for (const x of xs) if (!cols.length || x - (cols[cols.length - 1] ?? 0) > COL_GAP_MIN) cols.push(x);

    const rows: string[][] = [];
    for (const [top, bot] of bands) {
      const inBand = cellLines.filter((l) => l.baseline > top && l.baseline <= bot);
      if (!inBand.length) continue;
      const cells: string[][] = cols.map(() => []);
      for (const l of [...inBand].sort((a, b) => a.baseline - b.baseline || a.x0 - b.x0)) {
        const frags = l.parts.length ? l.parts : [{ text: l.text, x0: l.x0 }];
        // Acumula por coluna dentro da MESMA linha visual antes de empilhar,
        // para não intercalar fragmentos de colunas diferentes.
        const perCol: string[][] = cols.map(() => []);
        for (const f of frags) {
          let ci = 0;
          for (let k = cols.length - 1; k >= 0; k--) {
            if (f.x0 >= (cols[k] ?? 0) - TOL_X) {
              ci = k;
              break;
            }
          }
          perCol[ci]?.push(f.text);
        }
        perCol.forEach((frag, ci) => {
          if (frag.length) cells[ci]?.push(frag.join(" ").replace(/\s+/g, " ").trim());
        });
      }
      rows.push(cells.map((c) => joinWrapped(c)));
    }
    if (rows.length) {
      // Largura de coluna = distância até o próximo início (a última vai até a
      // borda direita observada), normalizada pela largura total da tabela.
      const right = Math.max(...cellLines.map((l) => l.x1));
      const edges = [...cols, right];
      const spans = cols.map((_, i) => (edges[i + 1] ?? 0) - (edges[i] ?? 0));
      const total = spans.reduce((a, b) => a + b, 0);
      return { rows, colWidths: total > 0 ? spans.map((w) => w / total) : undefined };
    }
  }

  const byRow = new Map<number, Line[]>();
  for (const l of cellLines) {
    const key = Math.round(l.baseline / 4) * 4;
    (byRow.get(key) ?? byRow.set(key, []).get(key)!).push(l);
  }
  const rows: string[][] = [];
  for (const key of [...byRow.keys()].sort((a, b) => a - b)) {
    rows.push(
      byRow
        .get(key)!
        .sort((a, b) => a.x0 - b.x0)
        .map((l) => l.text),
    );
  }
  return { rows };
}

interface PendingNode {
  y0: number;
  node: BodyNode;
}

/** algorithm2e ruled frames: full-width horizontal rules, th ≈ 0.8bp. */
function extractAlgorithms(lines: Line[], page: PageIR, pending: PendingNode[]): void {
  const rules = page.vectors
    .filter((v) => v.orientation === "horizontal" && v.thickness >= 0.7 && v.thickness <= 0.85 && v.bbox.x0 < LEFT + 6)
    .sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const firstRule = rules[0];
  const lastRule = rules[rules.length - 1];
  if (rules.length < 2 || !firstRule || !lastRule) return;
  const top = firstRule.bbox.y0;
  const bottom = lastRule.bbox.y1;
  const inside = lines.filter((x) => !x.consumed && x.y0 >= top - 14 && x.y0 <= bottom + 2);
  const firstInside = inside[0];
  if (!firstInside) return;
  const capLine = inside.find((x) => /^Algoritmo \d+ ?:/.test(x.text));
  const node: import("./semantic.js").CodeNode = {
    kind: "code",
    variant: "algorithm",
    caption: capLine?.text.replace(/^Algoritmo \d+ ?: ?/, ""),
    lines: [],
    page: firstInside.page,
  };
  for (const x of inside) {
    x.consumed = true;
    if (x !== capLine) node.lines.push(x.text);
  }
  pending.push({ y0: top, node });
}

// ---------------------------------------------------------------------------
// Front matter (capa, folha de rosto, ficha catalográfica, folha de aprovação)
// ---------------------------------------------------------------------------

/** Assinaturas textuais que identificam cada página pré-textual. */
const SIG_PREAMBLE = /^(Trabalho de Conclusão de Curso|Dissertação|Tese|Proposta de qualificação) apresentad/;
const SIG_CATALOG = /Ficha Catalográfica|Formulário Eletrônico|^CDU$/i;
const SIG_BOARD = /^BANCA EXAMINADORA$/;
const SIG_ADVISOR = /^Orientador(a)? ?:/;
const SIG_APPROVED = /^Aprovad[oa] em ?:/;

/**
 * Lê as páginas pré-textuais que não são seções.
 *
 * Escopo: da página 1 até a primeira página de RESUMO/ABSTRACT/sumário. É onde
 * vivem os dados que o `documento.tex` precisa (curso, cidade, ano, orientador,
 * banca) e as flags que dizem quais `\imprimir*` o original realmente usa.
 */
function extractFrontMatter(ir: DocumentIR): FrontMatter {
  const fm: FrontMatter = {
    institutionLines: [],
    board: [],
    has: {
      catalogCard: false,
      approvalSheet: false,
      illustrationList: false,
      tableList: false,
      abbreviationList: false,
      symbolList: false,
    },
  };
  const author = (ir.metadata.Author ?? "").toLocaleUpperCase("pt-BR");

  for (const page of ir.pages) {
    const lines = flattenPage(page);
    const texts = lines.map((l) => l.text);
    const joined = texts.join(" ");

    if (texts.some((t) => /^LISTA DE ILUSTRA[ÇC]/i.test(t))) fm.has.illustrationList = true;
    if (texts.some((t) => /^LISTA DE TABELAS$/i.test(t))) fm.has.tableList = true;
    if (texts.some((t) => /^LISTA DE ABREVIATURAS/i.test(t))) fm.has.abbreviationList = true;
    if (texts.some((t) => /^LISTA DE S[ÍI]MBOLOS$/i.test(t))) fm.has.symbolList = true;
    if (SIG_CATALOG.test(joined)) fm.has.catalogCard = true;
    if (texts.some((t) => SIG_BOARD.test(t)) || texts.some((t) => SIG_APPROVED.test(t))) {
      fm.has.approvalSheet = true;
      collectBoard(lines, fm);
    }

    // Capa: primeira página, cabeçalho em caixa alta + cidade/ano no rodapé.
    if (page.index === 0) {
      for (const l of lines) {
        if (!isUpper(l.text)) continue;
        if (author && l.text === author) break; // cabeçalho termina no autor
        fm.institutionLines.push(l.text);
      }
      const bottom = lines.filter((l) => l.y0 > page.height * 0.8);
      for (const l of bottom) {
        if (/^\d{4}$/.test(l.text)) fm.year = l.text;
        else if (isUpper(l.text) && /[–—-]/.test(l.text)) fm.city = l.text;
      }
    }

    // Folha de rosto: parágrafo de natureza do trabalho + orientador.
    if (!fm.preamble) {
      const start = lines.findIndex((l) => SIG_PREAMBLE.test(l.text));
      const anchor = lines[start];
      if (anchor) {
        const parts: string[] = [];
        for (let i = start; i < lines.length; i++) {
          const line = lines[i];
          if (!line) break;
          if (SIG_ADVISOR.test(line.text)) break;
          if (Math.abs(line.x0 - anchor.x0) > 6) break;
          parts.push(line.text);
        }
        fm.preamble = joinWrapped(parts);
      }
    }
    if (!fm.advisor) {
      const i = lines.findIndex((l) => SIG_ADVISOR.test(l.text));
      const anchor = lines[i];
      if (anchor) {
        const parts = [anchor.text.replace(SIG_ADVISOR, "").trim()];
        for (let k = i + 1; k < lines.length; k++) {
          const line = lines[k];
          if (!line || Math.abs(line.x0 - anchor.x0) > 6) break;
          parts.push(line.text);
        }
        fm.advisor = joinWrapped(parts);
      }
    }

    // O sumário fecha os pré-textuais — as listas de ilustrações/tabelas vêm
    // ANTES dele e depois do resumo, então parar no resumo perdia as flags.
    if (texts.some((t) => /^SUMÁRIO$/.test(t))) break;
  }
  return fm;
}

/**
 * Banca: cada membro é um nome centrado sob uma régua de assinatura, seguido de
 * até duas linhas de vínculo (centro e IES). O primeiro traz "(Orientador)".
 */
function collectBoard(lines: Line[], fm: FrontMatter): void {
  const start = lines.findIndex((l) => SIG_BOARD.test(l.text));
  if (start < 0) return;
  const NAME = /^(Prof|Profa|Dr|Dra|Me|Ma)\b|^[A-ZÀ-Ú][a-zà-ú]+ [A-ZÀ-Ú]/;
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i]?.text ?? "";
    if (!NAME.test(t) || /^(Universidade|Centro|Faculdade|Instituto)/.test(t)) continue;
    const member: FrontMatter["board"][number] = { name: t.replace(/\s*\(Orientador[a]?\)\s*$/, "").trim() };
    for (let k = i + 1; k < lines.length && k <= i + 2; k++) {
      const v = lines[k]?.text ?? "";
      if (/^(Centro|Faculdade|Instituto)/.test(v)) member.center = v;
      else if (/^Universidade/.test(v)) member.ies = v;
      else break;
    }
    fm.board.push(member);
  }
}

// ---------------------------------------------------------------------------
// Main classifier
// ---------------------------------------------------------------------------

export function classify(ir: DocumentIR): SemanticDoc {
  const doc: SemanticDoc = {
    metadata: { title: ir.metadata.Title, author: ir.metadata.Author },
    frontMatter: extractFrontMatter(ir),
    pretextual: [],
    body: [],
    footnotes: [],
    bibliography: [],
    posttextual: [],
    unclassified: [],
  };

  const outlineTitles = buildOutlineIndex(ir.outline);

  type Mode = "pretextual" | "skip" | "body" | "bibliography" | "posttextual";
  let mode: Mode = "pretextual";
  let pendingSection: PretextualSection | null = null;
  let bibParts: { parts: string[]; emphasized: string[]; page: number } | null = null;
  let para: { parts: string[]; hasMath: boolean; page: number } | null = null;
  let list: ListNode | null = null;
  /** x0 do marcador do item corrente — base do recuo pendente. Interno. */
  let listItemX0 = 0;
  let quote: { parts: string[]; page: number } | null = null;
  let code: import("./semantic.js").CodeNode | null = null;
  let pendingCodeCaption: string | null = null;

  const flushPara = () => {
    if (para) {
      doc.body.push({ kind: "paragraph", text: joinWrapped(para.parts), hasInlineMath: para.hasMath, page: para.page });
      para = null;
    }
  };
  const flushList = () => {
    if (list) {
      doc.body.push(list);
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote) {
      doc.body.push({ kind: "quote", text: joinWrapped(quote.parts), page: quote.page });
      quote = null;
    }
  };
  const flushCode = () => {
    if (code) {
      doc.body.push(code);
      code = null;
    }
  };
  const flushBib = () => {
    if (bibParts) {
      doc.bibliography.push({ raw: joinWrapped(bibParts.parts), emphasized: bibParts.emphasized, page: bibParts.page });
      bibParts = null;
    }
  };
  const flushSection = () => {
    if (pendingSection) {
      (mode === "posttextual" ? doc.posttextual : doc.pretextual).push(pendingSection);
      pendingSection = null;
    }
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
    flushCode();
  };

  for (const page of ir.pages) {
    const lines = flattenPage(page);
    const tocPage = isTocPage(lines);
    stripFolio(lines);
    extractFootnotes(lines, doc.footnotes);
    markLists(lines, list ? listItemX0 : undefined);
    const pending: PendingNode[] = [];
    if (mode === "body") {
      extractAlgorithms(lines, page, pending);
      extractFloats(lines, page, pending);
      pending.sort((a, b) => a.y0 - b.y0);
    }
    const drain = (y: number) => {
      for (let head = pending[0]; head && head.y0 <= y; head = pending[0]) {
        flushAll();
        pending.shift();
        doc.body.push(head.node);
      }
    };

    let prevBaseline = -Infinity;
    for (const [li, l] of lines.entries()) {
      if (l.consumed) continue;
      if (mode === "body") drain(l.y0);
      const gapBefore = l.baseline - prevBaseline;
      prevBaseline = l.baseline;

      // ---- mode transitions on headings -----------------------------------
      const unnum = matchUnnumberedChapter(l);
      if (unnum) {
        flushAll();
        flushBib();
        flushSection();
        if (unnum === "REFERÊNCIAS") {
          mode = "bibliography";
          doc.body.push({ kind: "heading", level: "chapter", numbered: false, title: unnum, page: l.page });
        } else if (POSTTEXTUAL_PREFIX.some((p) => unnum.startsWith(p))) {
          mode = "posttextual";
          pendingSection = { title: unnum, paragraphs: [], page: l.page };
        } else if (SKIP_TITLES_PREFIX.some((p) => unnum.startsWith(p))) {
          if ((["pretextual", "skip"] as Mode[]).includes(mode)) mode = "skip";
        } else {
          mode = "pretextual";
          pendingSection = { title: unnum, paragraphs: [], page: l.page };
        }
        continue;
      }

      // Numa página de sumário nenhuma linha é heading: a entrada de duas
      // linhas do sumário imita um capítulo e, ao casar, arrastava o modo
      // para "body" páginas antes do primeiro capítulo real.
      const heading = mode !== "bibliography" && !tocPage ? matchHeading(l, gapBefore) : null;
      if (heading) {
        // Título que transbordou para a(s) linha(s) seguintes: o outline diz
        // qual é o título íntegro, e absorvemos linhas até cobri-lo. Só
        // avança enquanto o acumulado continua sendo prefixo do gabarito, de
        // modo que um outline que não casa não consome nada.
        const full = repairTitle(heading.title, outlineTitles);
        if (full !== heading.title) {
          let acc = canonTitle(heading.title.replace(/-$/, ""));
          const target = canonTitle(full);
          for (let k = li + 1; k < lines.length && acc.length < target.length; k++) {
            const next = lines[k];
            if (!next || next.consumed) break;
            const cand = acc + canonTitle(next.text);
            if (!target.startsWith(cand)) break;
            next.consumed = true;
            acc = cand;
          }
          heading.title = full;
        }
        flushAll();
        flushSection();
        if (heading.level === "chapter") mode = "body";
        if (mode === "body") doc.body.push(heading);
        continue;
      }

      // ---- per-mode line handling -----------------------------------------
      if (mode === "skip") continue;
      if (isLeaderLine(l.text)) continue;

      if (mode === "pretextual" || mode === "posttextual") {
        if (!pendingSection) continue; // cover pages, catalog card, etc.
        // A linha "Palavras-chave: ..." começa na margem, sem recuo, e seria
        // colada ao parágrafo anterior — mas ela é um parágrafo próprio.
        const kwLine = KEYWORD_LABEL.test(l.text);
        if (kwLine || near(l.x0, INDENT) || pendingSection.paragraphs.length === 0)
          pendingSection.paragraphs.push(l.text);
        else {
          const last = pendingSection.paragraphs.length - 1;
          pendingSection.paragraphs[last] = joinWrapped([
            pendingSection.paragraphs[last] ?? "",
            l.text,
          ]);
        }
        continue;
      }

      if (mode === "bibliography") {
        if (!isBodySize(l) || !BODY_FONT.test(l.font)) continue;
        if (!bibParts || gapBefore > BIB_ENTRY_GAP) {
          flushBib();
          bibParts = { parts: [], emphasized: [], page: l.page };
        }
        bibParts.parts.push(l.text);
        for (const r of l.boldRuns) bibParts.emphasized.push(r);
        continue;
      }

      // ---- body mode -------------------------------------------------------
      // "Código-fonte N – title" caption precedes the listing
      const codeCap = /^Código-fonte (\d+) [–—-] (.*)$/.exec(l.text);
      if (codeCap && l.bold) {
        flushAll();
        pendingCodeCaption = codeCap[2] ?? null;
        continue;
      }
      // code listing lines: NR-Regu line number (≤8pt) + Type-3 tt spans
      if (l.codeLike) {
        flushPara();
        flushList();
        flushQuote();
        if (!code) {
          code = { kind: "code", variant: "listing", caption: pendingCodeCaption ?? undefined, lines: [], page: l.page };
          pendingCodeCaption = null;
        }
        code.lines.push(l.text.replace(/^\d+ /, ""));
        continue;
      }
      flushCode();


      // citação longa
      if (isReducedSize(l) && l.x0 >= QUOTE_X_MIN && l.x1 <= 545 && l.x0 <= QUOTE_X_MAX + 40 && !/^(Fonte|Nota) ?:/.test(l.text)) {
        flushPara();
        flushList();
        if (!quote) quote = { parts: [], page: l.page };
        quote.parts.push(l.text);
        continue;
      }
      flushQuote();

      // alíneas / bullets / itemize — papéis já resolvidos por markLists()
      if (l.listRole === "item") {
        flushPara();
        const style = /^(\([a-z]\)|[a-z]\)) /.test(l.text) ? "alpha" : /^\d/.test(l.text) ? "numeric" : "bullet";
        if (!list || list.style !== style || Math.abs(listItemX0 - l.x0) > TOL_X) {
          flushList();
          list = { kind: "list", style, items: [], page: l.page };
          listItemX0 = l.x0;
        }
        list.items.push(l.text.replace(ITEM_MARKER, ""));
        continue;
      }
      if (l.listRole === "cont" && list && list.items.length) {
        list.items[list.items.length - 1] = joinWrapped([
          list.items[list.items.length - 1] ?? "",
          l.text,
        ]);
        continue;
      }
      flushList();

      // equation number "(N.N)" and stray sub/superscript fragments attach
      // to an adjacent display-math region (same page, one leading apart)
      const lastNode = doc.body[doc.body.length - 1];
      const nearMath = lastNode?.kind === "displayMath" && lastNode.page === l.page && gapBefore <= 60 && !para;
      if (nearMath && /^\(\d+\.\d+\)$/.test(l.text)) {
        lastNode.raw += ` ${l.text}`;
        continue;
      }
      const mathFragment = l.text.length <= 12 && !/[A-ZÀ-Ú]{2,}|[a-zà-ú]{3,}/.test(l.text);
      if (nearMath && mathFragment && !near(l.x0, LEFT) && !near(l.x0, INDENT)) {
        lastNode.raw += ` ${l.text}`;
        continue;
      }
      // display math: line dominated by math-font glyphs, off both margins.
      // Consecutive math lines (matrices, aligned eqs) coalesce into one region.
      if (l.hasMath && !near(l.x0, LEFT) && !near(l.x0, INDENT)) {
        flushPara();
        flushQuote();
        const prev = doc.body[doc.body.length - 1];
        if (prev?.kind === "displayMath" && prev.page === l.page && gapBefore <= 60) {
          prev.raw = (prev.raw + " " + l.text).trim();
        } else {
          doc.body.push({ kind: "displayMath", raw: l.text, page: l.page });
        }
        continue;
      }

      // paragraphs
      if (isBodySize(l) && (near(l.x0, INDENT) || near(l.x0, LEFT))) {
        if (near(l.x0, INDENT) || !para) {
          flushPara();
          para = { parts: [], hasMath: false, page: l.page };
        }
        para.parts.push(l.text);
        para.hasMath ||= l.hasMath;
        continue;
      }

      doc.unclassified.push({ page: l.page, text: l.text });
    }
    // paragraphs, lists and long quotes may continue across pages
    if (mode === "body") drain(Infinity);
    flushCode();
  }
  flushAll();
  flushBib();
  flushSection();
  return doc;
}
