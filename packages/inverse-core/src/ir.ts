// Arquivo vendorado de uecetex-inverse (ab0eb48d3029b8ddce28dfd8f645afd06e9cb500) por
// scripts/vendor-inverse-core.sh. NÃO EDITE AQUI: a mudança se perde na
// próxima vendorização. Corrija na origem, que é onde ele é verificado.
// @ts-nocheck
/**
 * Stage 1 — Typed Intermediate Representation (IR)
 *
 * Raw, deterministic extraction of a PDF produced by ueceTeX2.
 * No semantic interpretation happens here: that is Stage 2's job.
 * Same input bytes MUST always yield the same IR (see canonicalization
 * notes in extract.ts).
 */

/** Axis-aligned bounding box in PDF user space (origin top-left, points). */
export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * A run of glyphs sharing font, size and baseline.
 * `font` is the canonical PostScript name with the random subset
 * prefix (e.g. "OBUZLY+") stripped, so IRs are stable across
 * recompilations of the same source.
 */
export interface TextSpan {
  kind: "text";
  text: string;
  font: string;
  /** Font size in points, rounded to 0.01pt. */
  size: number;
  bold: boolean;
  italic: boolean;
  bbox: BBox;
  /** Baseline y of the containing line (top-left origin). */
  baseline: number;
  /** Writing mode: 0 horizontal, 1 vertical. */
  wmode: number;
}

/** A visual line as segmented by the layout engine. */
export interface TextLine {
  kind: "line";
  bbox: BBox;
  spans: TextSpan[];
}

/** A layout block: a paragraph-ish cluster of lines. */
export interface TextBlock {
  kind: "textBlock";
  bbox: BBox;
  lines: TextLine[];
}

/** A placed raster image (figure candidate). */
export interface ImageBlock {
  kind: "imageBlock";
  bbox: BBox;
  /** Intrinsic pixel dimensions of the embedded image. */
  width: number;
  height: number;
  /** SHA-256 of the decoded RGB pixels — stable content identity. */
  sha256: string;
  /** Filename this image was exported to, relative to the assets dir. */
  file?: string;
}

/**
 * A straight path segment from the vector layer.
 * Table rules (booktabs \toprule/\midrule/\bottomrule), signature
 * lines and algorithm2e frames all surface here.
 */
export interface VectorSegment {
  kind: "vector";
  bbox: BBox;
  orientation: "horizontal" | "vertical" | "other";
  /** Stroke width in points (0 for fills collapsed to thin rects). */
  thickness: number;
}

/** Internal (GoTo) or external (URI) link annotation. */
export interface LinkRegion {
  kind: "link";
  bbox: BBox;
  target: { type: "internal"; page: number } | { type: "external"; uri: string };
}

export interface PageIR {
  /** 0-based page index in the PDF file. */
  index: number;
  /** Printed folio if resolvable from page-number span, else null. */
  width: number;
  height: number;
  blocks: TextBlock[];
  images: ImageBlock[];
  vectors: VectorSegment[];
  links: LinkRegion[];
}

export interface DocumentIR {
  /** SHA-256 of the input PDF bytes. */
  sourceSha256: string;
  pageCount: number;
  /** PDF Info dictionary — Title/Author land here (\imprimirtitulo etc.). */
  metadata: Record<string, string>;
  /** Document outline (PDF bookmarks) — mirrors the LaTeX sectioning tree. */
  outline: OutlineNode[];
  /** Distinct canonical font names seen, with usage stats. */
  fonts: FontUsage[];
  pages: PageIR[];
}

export interface OutlineNode {
  title: string;
  /** 0-based target page, -1 when unresolved. */
  page: number;
  children: OutlineNode[];
}

export interface FontUsage {
  font: string;
  bold: boolean;
  italic: boolean;
  /** Distinct sizes observed (points). */
  sizes: number[];
  /** Total characters set in this font. */
  chars: number;
}
