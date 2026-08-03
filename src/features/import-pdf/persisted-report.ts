import type { PendencyMarker } from "./pendency-markers";

export interface ImportReportPendency {
  kind: string;
  page: number;
  excerpt: string;
}

export interface ValidatedImportReport {
  schemaVersion: 0 | 1;
  pendencies: ImportReportPendency[];
  /** Present only in schema 1; already reconciled with the original markers. */
  staticPendencies?: ImportReportPendency[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validPendency(value: unknown): ImportReportPendency | null {
  if (!isRecord(value)) return null;
  const { kind, page, excerpt } = value;
  if (
    typeof kind !== "string" ||
    kind.trim() === "" ||
    typeof page !== "number" ||
    !Number.isInteger(page) ||
    page < 1 ||
    typeof excerpt !== "string"
  ) {
    return null;
  }
  return { kind, page, excerpt };
}

function validPendencyList(value: unknown): ImportReportPendency[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((entry) => {
    const valid = validPendency(entry);
    return valid ? [valid] : [];
  });
}

/** Validates both legacy reports and the current persisted schema. */
export function validateImportReport(value: unknown): ValidatedImportReport | null {
  if (!isRecord(value)) return null;
  const schemaVersion = value.schemaVersion === undefined ? 0 : value.schemaVersion;
  if (schemaVersion !== 0 && schemaVersion !== 1) return null;
  const pendencies = validPendencyList(value.pendencias);
  if (!pendencies) return null;
  if (schemaVersion === 0) return { schemaVersion, pendencies };
  const staticPendencies = validPendencyList(value.staticPendencies);
  if (!staticPendencies) return null;
  return { schemaVersion, pendencies, staticPendencies };
}

function reportKindOf(marker: PendencyMarker): string {
  if (typeof marker.kind === "object") return marker.kind.other;
  return marker.kind === "equacao-inline" ? "equacao" : marker.kind;
}

/**
 * Legacy reports did not say which entries had a live marker. Match them by
 * kind and occurrence, leaving only entries that have nowhere to navigate.
 */
export function staticPendenciesFromReport(
  pendencies: readonly ImportReportPendency[],
  markers: readonly PendencyMarker[],
): ImportReportPendency[] {
  const markerCounts = new Map<string, number>();
  for (const marker of markers) {
    const kind = reportKindOf(marker);
    markerCounts.set(kind, (markerCounts.get(kind) ?? 0) + 1);
  }

  const unmatched: ImportReportPendency[] = [];
  for (const pendency of pendencies) {
    if (pendency.kind === "nao-classificado") {
      unmatched.push(pendency);
      continue;
    }
    const remaining = markerCounts.get(pendency.kind) ?? 0;
    if (remaining > 0) markerCounts.set(pendency.kind, remaining - 1);
    else unmatched.push(pendency);
  }
  return unmatched;
}

/** Adds the current schema while preserving the human-readable report fields. */
export function makePersistedImportReport(
  report: unknown,
  staticPendencies: readonly ImportReportPendency[],
): Record<string, unknown> {
  return {
    ...(isRecord(report) ? report : {}),
    schemaVersion: 1,
    staticPendencies: [...staticPendencies],
  };
}
