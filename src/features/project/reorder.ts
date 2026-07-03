/**
 * Chapter reorder (§4.6): rewrite the \input sequence in documento.tex,
 * touching ONLY the \input{...} argument texts — indentation, comments and
 * surrounding lines stay byte-identical.
 */

export function rewriteInputOrder(
  source: string,
  currentOrder: string[],
  newOrder: string[],
): string {
  if (
    currentOrder.length !== newOrder.length ||
    [...currentOrder].sort().join("\n") !== [...newOrder].sort().join("\n")
  ) {
    throw new Error("A nova ordem não cobre o mesmo conjunto de capítulos");
  }

  const wanted = new Set(currentOrder);
  const pattern = /\\input\{([^}]*)\}/g;
  const slots: { start: number; end: number; target: string }[] = [];
  for (const match of source.matchAll(pattern)) {
    const target = match[1] ?? "";
    if (wanted.has(target)) {
      slots.push({
        start: (match.index ?? 0) + "\\input{".length,
        end: (match.index ?? 0) + "\\input{".length + target.length,
        target,
      });
    }
  }
  if (slots.length !== currentOrder.length) {
    throw new Error("A nova ordem não cobre o mesmo conjunto de capítulos");
  }

  let out = "";
  let cursor = 0;
  slots.forEach((slot, i) => {
    out += source.slice(cursor, slot.start) + (newOrder[i] ?? slot.target);
    cursor = slot.end;
  });
  out += source.slice(cursor);
  return out;
}
