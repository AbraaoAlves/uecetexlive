import { describe, expect, it } from "vitest";
import type { MetadataField } from "@/features/project/metadata";
import {
  type ComplianceCheck,
  type ComplianceInput,
  computeComplianceChecklist,
  effectiveItems,
  pendingItemCount,
} from "./compliance-checklist";

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
    expect(figures?.action).toEqual({
      kind: "openFile",
      path: "cap1.tex",
      line: 1,
      mode: "source",
    });
  });

  it("enumerates figures by severity, then file and line", () => {
    const checks = computeComplianceChecklist(
      baseInput({
        texSources: {
          "b.tex": [
            "\\begin{figure}",
            "\\end{figure}",
            "",
            "\\begin{figure}",
            "\\caption{B com legenda}",
            "\\end{figure}",
          ].join("\n"),
          "a.tex": [
            "\\begin{figure}",
            "\\Fonte{Autor}",
            "\\end{figure}",
            "",
            "\\begin{figure}",
            "\\caption{   }",
            "\\end{figure}",
          ].join("\n"),
        },
      }),
    );

    expect(checks.find((check) => check.id === "figures")?.items).toEqual([
      {
        id: "b.tex:0",
        label: "Figura 1 de b.tex",
        detail: "Sem legenda e sem indicação de fonte.",
        reason: "sem-legenda-e-fonte",
        action: { kind: "openFile", path: "b.tex", line: 1, mode: "source" },
      },
      {
        id: "a.tex:0",
        label: "Figura 1 de a.tex",
        detail: "Sem legenda.",
        reason: "sem-legenda",
        action: { kind: "openFile", path: "a.tex", line: 1, mode: "source" },
      },
      {
        id: "b.tex:1",
        label: "B com legenda",
        detail: "Sem indicação de fonte.",
        reason: "sem-fonte",
        action: { kind: "openFile", path: "b.tex", line: 4, mode: "source" },
      },
      {
        id: "a.tex:1",
        label: "Figura 2 de a.tex",
        detail: "Sem indicação de fonte.",
        reason: "sem-fonte",
        action: { kind: "openFile", path: "a.tex", line: 5, mode: "source" },
      },
    ]);
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

  // Whoever enumerates must keep count in sync with items, or the rail badge
  // and the per-check header disagree about the same check.
  it("keeps count equal to items.length wherever a check enumerates", () => {
    const checks = computeComplianceChecklist(
      baseInput({ bibText: INCOMPLETE_BIB, meta: EMPTY_META }),
    );
    for (const check of checks) {
      if (check.items) expect(check.count, check.id).toBe(check.items.length);
    }
  });

  // Sem .bib não há para onde levar o aluno: um "corrigir" que não faz nada é
  // pior do que nenhum atalho.
  it("não oferece atalho de referências num projeto sem .bib", () => {
    const checks = computeComplianceChecklist(
      baseInput({ bibText: null, texSources: { "cap.tex": "\\citeonline{naoexiste}" } }),
    );
    const orphans = checks.find((c) => c.id === "orphanCitations");
    expect(orphans?.status).toBe("warn");
    expect(orphans?.action).toBeUndefined();
  });
});

/**
 * Not every check can name its offenders (pré-textuais and resumo don't), so
 * anything that walks "one item at a time" — the badge, "corrigir o próximo" —
 * needs a shape that covers both kinds without special-casing.
 */
describe("effectiveItems / pendingItemCount", () => {
  function check(over: Partial<ComplianceCheck>): ComplianceCheck {
    return { id: "references", status: "warn", count: 1, ...over };
  }

  it("stands in for a warning check that cannot enumerate", () => {
    const items = effectiveItems(
      check({ id: "pretextual", count: 5, action: { kind: "openMetadata" } }),
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.action).toEqual({ kind: "openMetadata" });
    expect(items[0]?.id).toBe("pretextual");
  });

  it("passes the real items through when the check enumerates", () => {
    const real = [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ];
    expect(effectiveItems(check({ count: 2, items: real }))).toEqual(real);
  });

  it("has nothing to offer for a check that is ok", () => {
    expect(effectiveItems(check({ status: "ok", count: 0 }))).toHaveLength(0);
  });

  // Quando quem enumera erra o count, quem manda é a lista: o badge conta o
  // que o aluno vai realmente percorrer, não um número declarado à parte.
  it("segue os items, não o count, quando os dois discordam", () => {
    const inconsistent = check({ count: 5, items: [{ id: "a", label: "A" }] });
    expect(pendingItemCount([inconsistent])).toBe(1);
  });

  it("counts items, not checks", () => {
    const checks: ComplianceCheck[] = [
      check({ id: "pretextual", count: 5, action: { kind: "openMetadata" } }),
      check({
        id: "references",
        count: 3,
        items: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
      }),
      check({ id: "figures", status: "ok", count: 0 }),
    ];
    // 1 (pré-textuais, não enumera) + 3 (referências) + 0 (em ordem)
    expect(pendingItemCount(checks)).toBe(4);
  });
});
