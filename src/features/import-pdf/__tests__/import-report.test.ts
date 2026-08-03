import { describe, expect, it } from "vitest";
import type { PendencyMarker } from "../pendency-markers";
import {
  makePersistedImportReport,
  staticPendenciesFromReport,
  validateImportReport,
} from "../persisted-report";

const citationMarker: PendencyMarker = {
  kind: "citacao-nao-ligada",
  path: "cap.tex",
  line: 3,
  detail: "ligar às referências — trecho",
};

describe("persisted import report", () => {
  it("validates legacy entries tolerantly and keeps only pendencies without markers", () => {
    const report = validateImportReport({
      pendencias: [
        { kind: "citacao-nao-ligada", page: 2, excerpt: "Citação literal" },
        { kind: "nao-classificado", page: 8, excerpt: "Linha sem capítulo" },
        { kind: "equacao", page: "inválida", excerpt: "ignorar" },
      ],
    });

    expect(report?.schemaVersion).toBe(0);
    expect(report?.pendencies).toHaveLength(2);
    expect(
      staticPendenciesFromReport(report?.pendencies ?? [], [citationMarker]),
    ).toEqual([{ kind: "nao-classificado", page: 8, excerpt: "Linha sem capítulo" }]);
    expect(staticPendenciesFromReport(report?.pendencies ?? [], [])).toHaveLength(2);
  });

  it("persists the reconciled static list so removed markers do not return on reload", () => {
    const legacy = {
      chapters: 1,
      pendencias: [{ kind: "citacao-nao-ligada", page: 2, excerpt: "Citação literal" }],
    };
    const staticPendencies = staticPendenciesFromReport(
      validateImportReport(legacy)?.pendencies ?? [],
      [citationMarker],
    );
    const persisted = makePersistedImportReport(legacy, staticPendencies);
    const reloaded = validateImportReport(persisted);

    expect(reloaded?.schemaVersion).toBe(1);
    expect(reloaded?.staticPendencies).toEqual([]);
  });

  it("recalculates the static list when a new import replaces the report", () => {
    const first = staticPendenciesFromReport(
      [{ kind: "nao-classificado", page: 4, excerpt: "Primeiro PDF" }],
      [],
    );
    const second = staticPendenciesFromReport(
      [{ kind: "citacao-nao-ligada", page: 6, excerpt: "Segundo PDF" }],
      [citationMarker],
    );

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });

  it("rejects an unsupported future schema without reading its fields", () => {
    expect(validateImportReport({ schemaVersion: 99, pendencias: [] })).toBeNull();
  });
});
