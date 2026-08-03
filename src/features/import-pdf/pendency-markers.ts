export type KnownPendencyKind =
  | "equacao-inline"
  | "equacao"
  | "figura-sem-imagem"
  | "algoritmo"
  | "nota-rodape"
  | "citacao-nao-ligada";

export type PendencyKind = KnownPendencyKind | { other: string };

export interface PendencyMarker {
  kind: PendencyKind;
  path: string;
  /** 1-based. */
  line: number;
  detail: string;
}

const KIND_BY_LABEL: Record<string, KnownPendencyKind> = {
  "matemática inline": "equacao-inline",
  matemática: "equacao",
  figura: "figura-sem-imagem",
  algoritmo: "algoritmo",
  citação: "citacao-nao-ligada",
};
const PENDENCY_MARKER = /%% TODO\(([^)]+)\):[ \t]*(.*)$/;
const LINE_BREAK = /\r\n|\r|\n/g;

interface SourceLine {
  start: number;
  contentEnd: number;
  end: number;
}

function sourceLines(source: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let start = 0;
  for (const match of source.matchAll(LINE_BREAK)) {
    const contentEnd = match.index ?? start;
    const end = contentEnd + match[0].length;
    lines.push({ start, contentEnd, end });
    start = end;
  }
  lines.push({ start, contentEnd: source.length, end: source.length });
  return lines;
}

function pendencyKind(label: string): PendencyKind {
  const normalized = label.trim().toLocaleLowerCase("pt-BR");
  if (Object.hasOwn(KIND_BY_LABEL, normalized)) {
    return KIND_BY_LABEL[normalized] as KnownPendencyKind;
  }
  if (/^nota\s+(?:\d+|n)$/i.test(normalized)) return "nota-rodape";
  return { other: label.trim() };
}

/**
 * Scans TeX files for live import-review markers. Files in `order` come first;
 * files outside it follow alphabetically.
 */
export function scanPendencyMarkers(
  texSources: Record<string, string>,
  order: readonly string[],
): PendencyMarker[] {
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const path of order) {
    if (seen.has(path) || texSources[path] === undefined) continue;
    seen.add(path);
    paths.push(path);
  }
  const extras = Object.keys(texSources)
    .filter((path) => !seen.has(path))
    .sort((left, right) => left.localeCompare(right));
  paths.push(...extras);

  const markers: PendencyMarker[] = [];
  for (const path of paths) {
    const source = texSources[path];
    if (source === undefined) continue;
    for (const [index, line] of sourceLines(source).entries()) {
      const match = source.slice(line.start, line.contentEnd).match(PENDENCY_MARKER);
      if (!match?.[1]) continue;
      markers.push({
        kind: pendencyKind(match[1]),
        path,
        line: index + 1,
        detail: (match[2] ?? "").trim(),
      });
    }
  }
  return markers;
}

/** Removes exactly one live marker while preserving every unrelated byte. */
export function removePendencyMarkerAtLine(source: string, line: number): string {
  if (!Number.isInteger(line) || line < 1) return source;

  const target = sourceLines(source)[line - 1];
  if (!target) return source;

  const content = source.slice(target.start, target.contentEnd);
  const markerMatch = content.match(PENDENCY_MARKER);
  if (!markerMatch || markerMatch.index === undefined) return source;
  const markerOffset = markerMatch.index;
  const prefix = content.slice(0, markerOffset);

  if (prefix.trim() === "") {
    return source.slice(0, target.start) + source.slice(target.end);
  }
  return source.slice(0, target.start + markerOffset) + source.slice(target.contentEnd);
}
