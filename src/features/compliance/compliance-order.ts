import type { CheckId, ComplianceCheck } from "./compliance-checklist";

const PRIORITY: readonly CheckId[] = [
  "pretextual",
  "abstract",
  "references",
  "orphanCitations",
  "figures",
  "importPdf",
  "uncitedEntries",
];

const PRIORITY_INDEX = new Map(PRIORITY.map((id, index) => [id, index]));

/** Ordem de correção: primeiro o que bloqueia a entrega do trabalho. */
export function orderComplianceChecks(
  checks: readonly ComplianceCheck[],
): ComplianceCheck[] {
  return [...checks].sort(
    (left, right) =>
      (PRIORITY_INDEX.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (PRIORITY_INDEX.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
}
