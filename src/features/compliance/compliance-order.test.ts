import { describe, expect, it } from "vitest";
import type { ComplianceCheck } from "./compliance-checklist";
import { orderComplianceChecks } from "./compliance-order";

function check(id: ComplianceCheck["id"]): ComplianceCheck {
  return { id, status: "warn", count: 1 };
}

describe("orderComplianceChecks", () => {
  it("prioriza o que bloqueia a entrega acima da ordem de cálculo", () => {
    const checks = [
      check("uncitedEntries"),
      check("importPdf"),
      check("abstract"),
      check("orphanCitations"),
      check("figures"),
      check("references"),
      check("pretextual"),
    ];

    expect(orderComplianceChecks(checks).map((item) => item.id)).toEqual([
      "pretextual",
      "abstract",
      "references",
      "orphanCitations",
      "figures",
      "importPdf",
      "uncitedEntries",
    ]);
    expect(checks[0]?.id).toBe("uncitedEntries");
  });
});
