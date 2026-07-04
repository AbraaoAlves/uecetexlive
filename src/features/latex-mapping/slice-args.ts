/**
 * Raw-source argument scanner, shared by the WYSIWYG parser and the
 * metadata extractor. unified-latex only attaches args to macros with known
 * signatures, so callers scan the source directly from the macro-name end.
 */

export interface ArgSlices {
  opt: string | null;
  mandatory: string | null;
  /** Offset just past the closing brace of the mandatory group. */
  end: number;
}

/**
 * Extract [opt]{mandatory} slices for `\cmd…` from the raw source, starting
 * right after the macro name. Handles nested braces. Returns null on any
 * surprise (caller falls back to rawLatex).
 */
export function sliceArgs(
  source: string,
  from: number,
  wantOpt: boolean,
): ArgSlices | null {
  let i = from;
  let opt: string | null = null;
  if (wantOpt && source[i] === "[") {
    const close = source.indexOf("]", i);
    if (close === -1) return null;
    opt = source.slice(i + 1, close);
    i = close + 1;
  }
  if (source[i] !== "{") return null;
  let depth = 0;
  for (let j = i; j < source.length; j++) {
    const ch = source[j];
    if (ch === "\\") {
      j++;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return { opt, mandatory: source.slice(i + 1, j), end: j + 1 };
      }
    }
  }
  return null;
}
