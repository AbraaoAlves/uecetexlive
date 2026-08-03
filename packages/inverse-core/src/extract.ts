/**
 * Stage 1 — PDF -> IR extractor (deterministic).
 *
 * Determinism contract:
 *  1. No wall-clock, no randomness, no ML.
 *  2. Subset prefixes ("ABCDEF+") are stripped from font names, because
 *     pdfTeX regenerates them on every compilation.
 *  3. All floats are rounded to 0.01 before serialization so that
 *     FP noise in the layout engine can never leak into the output.
 *  4. Arrays are emitted in reading order (top-to-bottom, left-to-right)
 *     with a stable tie-breaking comparator.
 */
import { sha256 as sha256Bytes } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/**
 * SHA-256 sem `node:crypto`: a versão do Node é síncrona e não existe no
 * browser (a Web Crypto é assíncrona). Esta implementação é síncrona,
 * determinística e roda nos dois lugares — é o que permite o mesmo `extract`
 * no CLI e no navegador.
 */
/**
 * Enésimo operando a partir do fim da pilha (índice negativo). Os `case` deste
 * parser só chamam depois de conferir `nums.length`, mas o índice cru é
 * `number | undefined` sob `noUncheckedIndexedAccess` — o consumidor no app
 * compila com essa opção ligada.
 */
function at(nums: number[], fromEnd: number): number {
  return nums[nums.length + fromEnd] ?? 0;
}

function sha256(data: Uint8Array): string {
  return bytesToHex(sha256Bytes(data));
}

import * as mupdf from "mupdf";
import type {
  BBox,
  DocumentIR,
  FontUsage,
  ImageBlock,
  LinkRegion,
  OutlineNode,
  PageIR,
  TextBlock,
  TextLine,
  TextSpan,
  VectorSegment,
} from "./ir.js";

const R = (n: number): number => Math.round(n * 100) / 100;

/** Normaliza os limites PDF para as dimensões e o topo do espaço do usuário. */
export interface PageBounds {
  width: number;
  height: number;
  left: number;
  top: number;
}

export function pageBoundsOf(
  bounds: readonly [number, number, number, number],
): PageBounds {
  const [x0, y0, x1, y1] = bounds;
  return { width: R(x1 - x0), height: R(y1 - y0), left: R(x0), top: R(y1) };
}

/** Limita o intervalo pedido às páginas existentes, preservando a ordem. */
export function pageRangeOf(
  pageCount: number,
  requested?: readonly [number, number],
): [number, number] {
  if (pageCount === 0) return [0, -1];
  const lastPage = pageCount - 1;
  const [rawFrom, rawTo] = requested ?? [0, lastPage];
  const from = Math.max(0, Math.min(rawFrom, lastPage));
  const to = Math.max(from, Math.min(rawTo, lastPage));
  return [from, to];
}

/** "OBUZLY+NimbusRomNo9L-Medi" -> "NimbusRomNo9L-Medi" */
export function canonicalFontName(name: string): string {
  return name.replace(/^[A-Z]{6}\+/, "");
}

/** Heuristic-free style flags: derived from the font program itself. */
function styleFlags(
  fontName: string,
  mupdfFont?: mupdf.Font,
): { bold: boolean; italic: boolean } {
  // Prefer the font's own metrics tables when mupdf exposes them…
  if (mupdfFont) {
    return { bold: mupdfFont.isBold(), italic: mupdfFont.isItalic() };
  }
  // …fall back to PostScript-name conventions (stable for a fixed template).
  const n = fontName.toLowerCase();
  return {
    bold: /(-medi\b|-med\b|bold|-bd\b|heavy|black)/.test(n),
    italic: /(ital|oblique|slant|-it\b)/.test(n),
  };
}

function rectToBBox(r: [number, number, number, number]): BBox {
  return { x0: R(r[0]), y0: R(r[1]), x1: R(r[2]), y1: R(r[3]) };
}

/** Stable reading-order comparator (top-to-bottom, then left-to-right). */
function byReadingOrder(a: { bbox: BBox }, b: { bbox: BBox }): number {
  return (
    a.bbox.y0 - b.bbox.y0 ||
    a.bbox.x0 - b.bbox.x0 ||
    a.bbox.y1 - b.bbox.y1 ||
    a.bbox.x1 - b.bbox.x1
  );
}

// ---------------------------------------------------------------------------
// Text layer
// ---------------------------------------------------------------------------

interface XYWH {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface STextLine {
  wmode: number;
  bbox: XYWH;
  font: { name: string; family: string; weight: string; style: string; size: number };
  x: number;
  y: number;
  text: string;
}

function xywhToBBox(b: XYWH): BBox {
  return { x0: R(b.x), y0: R(b.y), x1: R(b.x + b.w), y1: R(b.y + b.h) };
}
interface STextBlock {
  type: "text" | "image";
  bbox: XYWH;
  lines?: STextLine[];
}

/**
 * Acentos compostos da codificação T1.
 *
 * `\v{c}` não é um glifo: o TeX desenha o acento, recua e desenha a base. No
 * content stream saem dois glifos, e o stext do mupdf os entrega na ordem em
 * que aparecem — daí "Beresnevi ˇcius" no lugar de "Beresnevičius".
 *
 * Isso não é cosmético: o texto corrompido chega às entradas bibliográficas,
 * o heurístico ABNT→BibTeX lê o acento solto como inicial de nome, e o BibTeX
 * (orientado a bytes) corta o UTF-8 de 2 bytes ao meio ao abreviar — o .bbl
 * sai com byte inválido e a compilação morre.
 *
 * O acento grave (U+0060) fica fora do mapa de propósito: em texto extraído
 * ele também aparece como aspa de abertura, e compor às cegas destruiria
 * citações.
 */
const T1_ACCENTS: Record<string, string> = {
  ˇ: "̌", // caron    ˇ
  "´": "́", // acute    ´
  "˜": "̃", // tilde    ˜
  "¨": "̈", // trema    ¨
  "˙": "̇", // ponto    ˙
  "˚": "̊", // anel     ˚
  "˝": "̋", // agudo duplo ˝
  "˛": "̨", // ogonek   ˛
  "¸": "̧", // cedilha  ¸
  ˆ: "̂", // circunflexo ˆ
  "¯": "̄", // mácron   ¯
  "˘": "̆", // breve    ˘
};
const ACCENT_CHARS = Object.keys(T1_ACCENTS).join("");
const HAS_ACCENT = new RegExp(`[${ACCENT_CHARS}]`);
const ONLY_ACCENTS = new RegExp(`^[${ACCENT_CHARS}\\s]+$`);

/** "ˇc" -> "č". Acento seguido de letra vira a forma precomposta (NFC). */
export function recomposeAccents(text: string): string {
  if (!HAS_ACCENT.test(text)) return text;
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const cur = text[i] ?? "";
    const comb = T1_ACCENTS[cur];
    const next = text[i + 1];
    if (comb && next && /\p{L}/u.test(next)) {
      out += (next + comb).normalize("NFC");
      i++;
    } else {
      out += cur;
    }
  }
  return out;
}

/**
 * Quando o acento sai em span próprio, ele fica sobre a base mas ordena por x0
 * depois dela (o acento em x=532 sobre o "e," em x=531). Reancora pelo x0:
 * o acento pertence à primeira letra do span que começa na mesma coluna.
 */
const ACCENT_ANCHOR_TOL = 3;

function mergeAccentSpans(spans: TextSpan[]): TextSpan[] {
  if (!spans.some((s) => ONLY_ACCENTS.test(s.text))) return spans;
  const dropped = new Set<number>();
  for (const [i, span] of spans.entries()) {
    if (!ONLY_ACCENTS.test(span.text)) continue;
    const acc = span.text.trim();
    let best = -1;
    let bestSpan: TextSpan | undefined;
    for (const [j, cand] of spans.entries()) {
      if (j === i || dropped.has(j) || ONLY_ACCENTS.test(cand.text)) continue;
      if (Math.abs(cand.bbox.x0 - span.bbox.x0) > ACCENT_ANCHOR_TOL) continue;
      if (!/^\p{L}/u.test(cand.text)) continue;
      if (best < 0 || (bestSpan && cand.bbox.x0 < bestSpan.bbox.x0)) {
        best = j;
        bestSpan = cand;
      }
    }
    if (best < 0 || !bestSpan) continue;
    spans[best] = { ...bestSpan, text: acc + bestSpan.text };
    dropped.add(i);
  }
  return spans.filter((_, i) => !dropped.has(i));
}

export function extractTextBlocks(
  page: mupdf.PDFPage,
  fontStats: Map<string, FontUsage>,
): TextBlock[] {
  const stext = page.toStructuredText("preserve-spans");
  try {
    return textBlocksFromData(
      JSON.parse(stext.asJSON()) as { blocks: STextBlock[] },
      fontStats,
    );
  } finally {
    stext.destroy();
  }
}

function textBlocksFromData(
  data: { blocks: STextBlock[] },
  fontStats: Map<string, FontUsage>,
): TextBlock[] {
  const blocks: TextBlock[] = [];

  for (const b of data.blocks) {
    if (b.type !== "text" || !b.lines?.length) continue;

    // mupdf's "preserve-spans" mode emits one JSON "line" per span and
    // groups spans of a visual line by identical baseline y. Rebuild lines.
    const byBaseline = new Map<number, STextLine[]>();
    for (const l of b.lines) {
      const key = R(l.y);
      const group = byBaseline.get(key) ?? [];
      group.push(l);
      byBaseline.set(key, group);
    }

    const lines: TextLine[] = [];
    for (const [baseline, rawSpans] of byBaseline) {
      const spans: TextSpan[] = rawSpans
        .filter((s) => s.text.length > 0)
        .map((s) => {
          const font = canonicalFontName(s.font.name);
          const { bold, italic } = {
            bold: s.font.weight === "bold" || styleFlags(font).bold,
            italic: s.font.style === "italic" || styleFlags(font).italic,
          };
          const size = R(s.font.size);
          const statKey = `${font}|${bold}|${italic}`;
          const stat = fontStats.get(statKey) ?? {
            font,
            bold,
            italic,
            sizes: [],
            chars: 0,
          };
          fontStats.set(statKey, stat);
          if (!stat.sizes.includes(size)) stat.sizes.push(size);
          stat.chars += s.text.length;
          return {
            kind: "text" as const,
            text: s.text,
            font,
            size,
            bold,
            italic,
            bbox: xywhToBBox(s.bbox),
            baseline,
            wmode: s.wmode,
          };
        });
      if (!spans.length) continue;
      spans.sort((a, b2) => a.bbox.x0 - b2.bbox.x0);
      // Acentos T1 antes de qualquer coisa consumir o texto: primeiro reancora
      // os que saíram em span próprio, depois compõe acento+base.
      const merged = mergeAccentSpans(spans).map((s) =>
        HAS_ACCENT.test(s.text) ? { ...s, text: recomposeAccents(s.text) } : s,
      );
      const bbox = union(merged.map((s) => s.bbox));
      lines.push({ kind: "line", bbox, spans: merged });
    }
    if (!lines.length) continue;
    lines.sort(byReadingOrder);
    blocks.push({ kind: "textBlock", bbox: union(lines.map((l) => l.bbox)), lines });
  }
  blocks.sort(byReadingOrder);
  return blocks;
}

function union(boxes: BBox[]): BBox {
  return {
    x0: R(Math.min(...boxes.map((b) => b.x0))),
    y0: R(Math.min(...boxes.map((b) => b.y0))),
    x1: R(Math.max(...boxes.map((b) => b.x1))),
    y1: R(Math.max(...boxes.map((b) => b.y1))),
  };
}

// ---------------------------------------------------------------------------
// Image layer
// ---------------------------------------------------------------------------

export function extractImages(
  page: mupdf.PDFPage,
  assets: Map<string, Uint8Array>,
  seen: Map<string, string>,
): ImageBlock[] {
  const out: ImageBlock[] = [];
  const stext = page.toStructuredText("preserve-images");
  try {
    stext.walk({
      onImageBlock(bbox, _transform, image) {
        const pix = image.toPixmap();
        try {
          const png = pix.asPNG();
          const digest = sha256(png);
          const file = `img-${digest.slice(0, 12)}.png`;
          if (!seen.has(digest)) {
            seen.set(digest, file);
            assets.set(file, png);
          }
          out.push({
            kind: "imageBlock",
            bbox: rectToBBox(bbox as never as [number, number, number, number]),
            width: pix.getWidth(),
            height: pix.getHeight(),
            sha256: digest,
            file,
          });
        } finally {
          pix.destroy();
        }
      },
    });
  } finally {
    stext.destroy();
  }
  out.sort(byReadingOrder);
  return out;
}

// ---------------------------------------------------------------------------
// Vector layer (table rules etc.)
// ---------------------------------------------------------------------------

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function matMul(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
  ];
}
function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function pageContentStream(page: mupdf.PDFPage): string {
  const c = page.getObject().get("Contents");
  const dec = new TextDecoder("latin1");
  if (!c || c.isNull()) return "";
  if (c.isArray()) {
    const parts: string[] = [];
    for (let i = 0; i < c.length; i++)
      parts.push(dec.decode(c.get(i).readStream().asUint8Array()));
    return parts.join("\n");
  }
  return dec.decode(c.readStream().asUint8Array());
}

/**
 * Minimal deterministic content-stream interpreter for the path subset
 * pdfTeX emits: q/Q (state), cm (transform), w (line width),
 * m/l (segments), re (rects), S/s (stroke), f/F/f* (fill), n (no-op).
 * Text (BT..ET) and everything else is skipped — the stext layer owns text.
 * Coordinates are flipped to the same top-left origin the stext JSON uses.
 */
export function vectorBBoxOf(
  segment: readonly [number, number, number, number],
  origin: Pick<PageBounds, "left" | "top">,
): BBox {
  const [x0, y0, x1, y1] = segment;
  return {
    x0: R(Math.min(x0, x1) - origin.left),
    y0: R(origin.top - Math.max(y0, y1)),
    x1: R(Math.max(x0, x1) - origin.left),
    y1: R(origin.top - Math.min(y0, y1)),
  };
}

function extractVectors(
  page: mupdf.PDFPage,
  origin: Pick<PageBounds, "left" | "top">,
): VectorSegment[] {
  const src = pageContentStream(page);
  const tokens =
    src.match(
      /\/[^\s/<>[\]()]+|<[^>]*>|\((?:\\.|[^\\)])*\)|\[[^\]]*\]|-?\d*\.?\d+|[A-Za-z'*]+/g,
    ) ?? [];

  const segments: VectorSegment[] = [];
  let ctm: Matrix = IDENTITY;
  const stack: { ctm: Matrix; lw: number }[] = [];
  let lw = 1;
  let inText = false;
  const nums: number[] = [];
  let path: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    from: [number, number] | null;
  }[] = [];
  let cur: [number, number] | null = null;

  const emit = (stroked: boolean) => {
    for (const seg of path) {
      const w = Math.abs(seg.x1 - seg.x0);
      const h = Math.abs(seg.y1 - seg.y0);
      const isHRule = h <= 2.5 && w >= 8;
      const isVRule = w <= 2.5 && h >= 8;
      if (!isHRule && !isVRule) continue;
      // scale line width by the CTM's dominant axis
      const scale = Math.sqrt(Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2])) || 1;
      segments.push({
        kind: "vector",
        bbox: vectorBBoxOf([seg.x0, seg.y0, seg.x1, seg.y1], origin),
        orientation: isHRule ? "horizontal" : "vertical",
        thickness: R(stroked ? lw * scale : Math.min(w, h)),
      });
    }
    path = [];
    cur = null;
  };

  for (const t of tokens) {
    if (/^-?\d*\.?\d+$/.test(t)) {
      nums.push(parseFloat(t));
      continue;
    }
    switch (t) {
      case "BT":
        inText = true;
        break;
      case "ET":
        inText = false;
        break;
      case "q":
        stack.push({ ctm, lw });
        break;
      case "Q":
        ({ ctm, lw } = stack.pop() ?? { ctm: IDENTITY, lw: 1 });
        break;
      case "cm":
        if (nums.length >= 6) ctm = matMul(nums.slice(-6) as Matrix, ctm);
        break;
      case "w":
        if (nums.length >= 1) lw = at(nums, -1);
        break;
      case "m":
        if (!inText && nums.length >= 2) cur = apply(ctm, at(nums, -2), at(nums, -1));
        break;
      case "l":
        if (!inText && cur && nums.length >= 2) {
          const p2 = apply(ctm, at(nums, -2), at(nums, -1));
          path.push({ x0: cur[0], y0: cur[1], x1: p2[0], y1: p2[1], from: cur });
          cur = p2;
        }
        break;
      case "re":
        if (!inText && nums.length >= 4) {
          const [x, y, w, h] = [at(nums, -4), at(nums, -3), at(nums, -2), at(nums, -1)];
          const [ax, ay] = apply(ctm, x, y);
          const [bx, by] = apply(ctm, x + w, y + h);
          path.push({ x0: ax, y0: ay, x1: bx, y1: by, from: null });
        }
        break;
      case "S":
      case "s":
        if (!inText) emit(true);
        break;
      case "f":
      case "F":
      case "f*":
      case "B":
      case "B*":
        if (!inText) emit(false);
        break;
      case "n":
        path = [];
        cur = null;
        break;
    }
    nums.length = 0;
  }
  segments.sort(byReadingOrder);
  return segments;
}

// ---------------------------------------------------------------------------
// Links & outline
// ---------------------------------------------------------------------------

function extractLinks(doc: mupdf.PDFDocument, page: mupdf.PDFPage): LinkRegion[] {
  const links: LinkRegion[] = [];
  for (const link of page.getLinks()) {
    const bbox = rectToBBox(
      link.getBounds() as never as [number, number, number, number],
    );
    const uri = link.getURI();
    links.push(
      link.isExternal()
        ? { kind: "link", bbox, target: { type: "external", uri } }
        : {
            kind: "link",
            bbox,
            target: { type: "internal", page: doc.resolveLink(uri) },
          },
    );
  }
  links.sort(byReadingOrder);
  return links;
}

type RawOutline = { title?: string; uri?: string; down?: RawOutline[] };
const MAX_OUTLINE_DEPTH = 32;

export function mapOutline(
  items: RawOutline[] | null | undefined,
  doc: mupdf.PDFDocument,
  depth = 0,
): OutlineNode[] {
  if (!items || depth >= MAX_OUTLINE_DEPTH) return [];
  return items.map((it) => ({
    title: it.title ?? "",
    page: it.uri ? doc.resolveLink(it.uri) : -1,
    children: mapOutline(it.down, doc, depth + 1),
  }));
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface ExtractOptions {
  /** Restrict to a page range [from, to] inclusive, 0-based. */
  pageRange?: [number, number];
}

/** IR do documento mais as figuras exportadas, em memória. */
export interface ExtractResult {
  ir: DocumentIR;
  /** nome do arquivo → bytes do PNG. Quem grava em disco é o chamador. */
  assets: Map<string, Uint8Array>;
}

/**
 * Estágio 1: PDF → IR + figuras. Sem `node:fs`: quem materializa os PNGs é o
 * chamador (o CLI grava em disco; o app do browser os põe no projeto).
 */
export function extract(pdfBytes: Uint8Array, opts: ExtractOptions = {}): ExtractResult {
  const assets = new Map<string, Uint8Array>();

  const doc = mupdf.PDFDocument.openDocument(
    pdfBytes,
    "application/pdf",
  ) as mupdf.PDFDocument;
  try {
    const pageCount = doc.countPages();
    const [from, to] = pageRangeOf(pageCount, opts.pageRange);

    const metadata: Record<string, string> = {};
    for (const key of ["Title", "Author", "Subject", "Keywords", "Creator", "Producer"]) {
      const v = doc.getMetaData(`info:${key}`);
      if (v) metadata[key] = v;
    }

    const fontStats = new Map<string, FontUsage>();
    const seenImages = new Map<string, string>();
    const pages: PageIR[] = [];

    for (let i = from; i <= to; i++) {
      const page = doc.loadPage(i) as mupdf.PDFPage;
      try {
        const bounds = pageBoundsOf(
          page.getBounds() as never as [number, number, number, number],
        );
        pages.push({
          index: i,
          width: bounds.width,
          height: bounds.height,
          blocks: extractTextBlocks(page, fontStats),
          images: extractImages(page, assets, seenImages),
          vectors: extractVectors(page, bounds),
          links: extractLinks(doc, page),
        });
      } finally {
        page.destroy();
      }
    }

    const fonts = [...fontStats.values()].sort((a, b) => b.chars - a.chars);
    for (const f of fonts) f.sizes.sort((a, b) => a - b);

    return {
      ir: {
        sourceSha256: sha256(pdfBytes),
        pageCount,
        metadata,
        outline: mapOutline(doc.loadOutline() as RawOutline[] | null, doc),
        fonts,
        pages,
      },
      assets,
    };
  } finally {
    doc.destroy();
  }
}

/** Compatibilidade: só a IR, para quem não precisa das figuras. */
export function extractIR(pdfBytes: Uint8Array, opts: ExtractOptions = {}): DocumentIR {
  return extract(pdfBytes, opts).ir;
}
