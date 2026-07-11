import { describe, expect, it } from "vitest";
import type { MetadataField } from "@/features/project/metadata";
import { type ComplianceInput, computeComplianceChecklist } from "./compliance-checklist";

const CITE_COMMANDS = ["citeonline", "Citeonline"];

function field(macro: string, value: string): [string, MetadataField] {
  return [macro, { macro, value, start: 0, end: value.length }];
}

const FILLED_META = new Map<string, MetadataField>([
  field("titulo", "Jogos Digitais no Ensino de Programação"),
  field("autor", "Maria Silva"),
  field("orientador", "Prof. Dr. João Souza"),
  field("data", "2026"),
  field("graduacaoem", "Engenharia de Software"),
  field(
    "resumobody",
    "Este trabalho investiga o uso de jogos digitais no ensino de programação.",
  ),
  field(
    "abstractbody",
    "This work investigates the use of digital games in teaching programming.",
  ),
]);

const EMPTY_META = new Map<string, MetadataField>([
  field("titulo", "Título do Trabalho"),
  field("autor", "Nome Sobrenome"),
  field("orientador", "Nome do seu Orientador"),
  field("data", "2017"),
  field(
    "resumobody",
    "Elemento obrigatório... Substitua este parágrafo pelo texto do seu resumo, e a linha abaixo...",
  ),
  field(
    "abstractbody",
    "Mandatory element... Replace this paragraph with your abstract, and the line below...",
  ),
]);

const COMPLETE_BIB = `@book{silva2026,
  author = {Silva, Maria},
  title = {Jogos Digitais},
  publisher = {Editora X},
  year = {2026}
}
`;

const INCOMPLETE_BIB = `@book{silva2026,
  author = {Silva, Maria},
  title = {Jogos Digitais},
  year = {2026}
}
`;

function baseInput(overrides: Partial<ComplianceInput>): ComplianceInput {
  return {
    meta: FILLED_META,
    workType: "tccgraduacao",
    bibText: COMPLETE_BIB,
    texSources: { "introducao.tex": "Como diz \\citeonline{silva2026}, ..." },
    citeCommands: CITE_COMMANDS,
    ...overrides,
  };
}

describe("computeComplianceChecklist", () => {
  it("reports everything ok for a fully filled, consistent project", () => {
    const checks = computeComplianceChecklist(baseInput({}));
    for (const check of checks) {
      expect(check.status, check.id).toBe("ok");
    }
  });

  it("flags unfilled pré-textual fields", () => {
    const checks = computeComplianceChecklist(baseInput({ meta: EMPTY_META }));
    const pretextual = checks.find((c) => c.id === "pretextual");
    expect(pretextual?.status).toBe("warn");
    expect(pretextual?.count).toBe(5); // titulo, autor, orientador, data, graduacaoem
  });

  it("flags resumo/abstract still showing the boilerplate placeholder", () => {
    const checks = computeComplianceChecklist(baseInput({ meta: EMPTY_META }));
    expect(checks.find((c) => c.id === "abstract")?.status).toBe("warn");
  });

  it("flags incomplete bibliography entries", () => {
    const checks = computeComplianceChecklist(baseInput({ bibText: INCOMPLETE_BIB }));
    const references = checks.find((c) => c.id === "references");
    expect(references?.status).toBe("warn");
    expect(references?.count).toBe(1);
  });

  it("treats a missing .bib file as ok (nothing to report)", () => {
    const checks = computeComplianceChecklist(baseInput({ bibText: null }));
    expect(checks.find((c) => c.id === "references")?.status).toBe("ok");
  });

  it("flags a figure missing caption or fonte", () => {
    const checks = computeComplianceChecklist(
      baseInput({
        texSources: {
          "introducao.tex": "Como diz \\citeonline{silva2026}, ...",
          "cap1.tex": "\\begin{figure}\\includegraphics{x}\\end{figure}",
        },
      }),
    );
    const figures = checks.find((c) => c.id === "figures");
    expect(figures?.status).toBe("warn");
    expect(figures?.count).toBe(1);
    expect(figures?.action).toEqual({ kind: "openFile", path: "cap1.tex" });
  });

  it("flags a citation with no matching bib entry as an orphan", () => {
    const checks = computeComplianceChecklist(
      baseInput({
        texSources: { "introducao.tex": "\\citeonline{naoexiste}" },
      }),
    );
    const orphans = checks.find((c) => c.id === "orphanCitations");
    expect(orphans?.status).toBe("warn");
    expect(orphans?.count).toBe(1);
  });

  it("flags a bib entry that's never cited", () => {
    const checks = computeComplianceChecklist(baseInput({ texSources: {} }));
    const uncited = checks.find((c) => c.id === "uncitedEntries");
    expect(uncited?.status).toBe("warn");
    expect(uncited?.count).toBe(1);
  });

  it("every check carries an action to jump to the fix", () => {
    const checks = computeComplianceChecklist(baseInput({ meta: EMPTY_META }));
    for (const check of checks) {
      if (check.status === "warn" && check.id !== "figures") {
        expect(check.action, check.id).toBeDefined();
      }
    }
  });
});
