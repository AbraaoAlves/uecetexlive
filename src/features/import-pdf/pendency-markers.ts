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

function pendencyKind(label: string): PendencyKind {
  const normalized = label.trim().toLocaleLowerCase("pt-BR");
  const known = KIND_BY_LABEL[normalized];
  if (known) return known;
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
    const lines = source.split(/\r\n?|\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const match = lines[index]?.match(/%% TODO\(([^)]+)\):[ \t]*(.*)$/);
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

  let lineStart = 0;
  for (let current = 1; current < line; current += 1) {
    const newline = source.indexOf("\n", lineStart);
    if (newline < 0) return source;
    lineStart = newline + 1;
  }

  const newline = source.indexOf("\n", lineStart);
  const physicalEnd = newline < 0 ? source.length : newline + 1;
  let contentEnd = newline < 0 ? source.length : newline;
  if (contentEnd > lineStart && source[contentEnd - 1] === "\r") contentEnd -= 1;

  const content = source.slice(lineStart, contentEnd);
  const markerOffset = content.indexOf("%% TODO(");
  if (markerOffset < 0) return source;
  const prefix = content.slice(0, markerOffset);

  if (prefix.trim() === "") {
    return source.slice(0, lineStart) + source.slice(physicalEnd);
  }
  return source.slice(0, lineStart + markerOffset) + source.slice(contentEnd);
}
