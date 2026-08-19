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

const TWO_INCOMPLETE_BIB = `@book{silva2026,
  author = {Silva, Maria},
  title = {Jogos Digitais},
  year = {2026}
}

@article{souza2025,
  author = {Souza, João},
  title = {Ensino de Programação},
  year = {2025}
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

  it("enumerates incomplete, orphan and uncited reference keys with useful intents", () => {
    const checks = computeComplianceChecklist(
      baseInput({
        bibText: TWO_INCOMPLETE_BIB,
        texSources: {
          "introducao.tex": "\\citeonline{silva2026} e \\citeonline{fantasma2024}",
        },
      }),
    );

    const references = checks.find((check) => check.id === "references");
    expect(references?.items).toHaveLength(2);
    expect(references?.items?.map((item) => item.label)).toEqual([
      "silva2026",
      "souza2025",
    ]);
    expect(references?.items?.[0]?.detail).toContain("Editora");
    expect(references?.items?.map((item) => item.action)).toEqual([
      { kind: "openReferences", key: "silva2026", intent: "focus" },
      { kind: "openReferences", key: "souza2025", intent: "focus" },
    ]);

    const orphans = checks.find((check) => check.id === "orphanCitations");
    expect(orphans?.items).toEqual([
      {
        id: "orphanCitations:fantasma2024",
        label: "fantasma2024",
        action: {
          kind: "openReferences",
          key: "fantasma2024",
          intent: "search",
        },
      },
    ]);

    const uncited = checks.find((check) => check.id === "uncitedEntries");
    expect(uncited?.items).toEqual([
      {
        id: "uncitedEntries:souza2025",
        label: "Ensino de Programação",
        detail: "Souza, J. · 2025",
        action: { kind: "openReferences", key: "souza2025", intent: "focus" },
      },
    ]);
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

  it("enumerates figures by severity, then reading order and line", () => {
    const checks = computeComplianceChecklist(
      baseInput({
        // b.tex vem antes no grafo de `\input`, embora venha depois no alfabeto:
        // a lista tem de seguir a ordem em que o aluno lê o trabalho.
        texOrder: ["b.tex", "a.tex"],
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

  it("keeps figures from files outside the include graph, after the ones inside", () => {
    const figure = ["\\begin{figure}", "\\end{figure}"].join("\n");
    const checks = computeComplianceChecklist(
      baseInput({
        texSources: { "zz-solto.tex": figure, "aa-solto.tex": figure, "cap.tex": figure },
        texOrder: ["cap.tex"],
      }),
    );

    // Nenhum arquivo fica de fora; o que o grafo não alcança entra depois, em
    // ordem alfabética — posição definida, não a ordem em que o mapa foi montado.
    expect(
      checks.find((check) => check.id === "figures")?.items?.map((item) => item.id),
    ).toEqual(["cap.tex:0", "aa-solto.tex:0", "zz-solto.tex:0"]);
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

  it("recognizes the generic \\cite command used by the project template", () => {
    const checks = computeComplianceChecklist(
      baseInput({ texSources: { "introducao.tex": "Texto \\cite{silva2026}." } }),
    );

    expect(checks.find((check) => check.id === "orphanCitations")?.status).toBe("ok");
    expect(checks.find((check) => check.id === "uncitedEntries")?.status).toBe("ok");
  });

  it("keeps an unclassified PDF excerpt honest about having no destination", () => {
    const checks = computeComplianceChecklist(
      baseInput({
        importUnclassified: [
          { excerpt: "Linha que não entrou em capítulo algum", page: 12 },
        ],
      }),
    );
    const item = checks.find((check) => check.id === "importPdf")?.items?.[0];

    expect(item?.action).toBeUndefined();
    expect(item?.detail).toContain("Linha que não entrou em capítulo algum");
    expect(item?.detail).toContain("p. 12");
    expect(item?.detail).toContain("Reescreva este trecho no capítulo certo");
  });

  it("drops the import count when a live marker is removed", () => {
    const withMarker = computeComplianceChecklist(
      baseInput({
        texSources: {
          "cap.tex": "Texto\n%% TODO(matemática): reconstruir a equação",
        },
        texOrder: ["cap.tex"],
        importUnclassified: [],
      }),
    );
    const withoutMarker = computeComplianceChecklist(
      baseInput({
        texSources: { "cap.tex": "Texto\nEquação reconstruída" },
        texOrder: ["cap.tex"],
        importUnclassified: [],
      }),
    );

    expect(withMarker.find((check) => check.id === "importPdf")?.count).toBe(1);
    expect(withoutMarker.find((check) => check.id === "importPdf")?.count).toBe(0);
  });

  it("labels import markers by kind, keeps unknown labels and stable ids", () => {
    const input = baseInput({
      texSources: {
        "cap.tex": [
          "%% TODO(matemática): reconstruir a equação",
          "%% TODO(rótulo inventado): conferir trecho raro",
        ].join("\n"),
      },
      texOrder: ["cap.tex"],
      importUnclassified: [
        {
          kind: "citacao-nao-ligada",
          excerpt: "Citação de projeto antigo",
          page: 4,
        },
        { kind: "nao-classificado", excerpt: "Linha sem capítulo", page: 9 },
      ],
    });
    const items = computeComplianceChecklist(input).find(
      (check) => check.id === "importPdf",
    )?.items;

    expect(items?.map((item) => item.label)).toEqual([
      "equação precisa ser refeita",
      "rótulo inventado",
      "citação não foi ligada às referências",
      "trecho não entrou em nenhum capítulo",
    ]);
    expect(items?.slice(0, 2).every((item) => item.action?.kind === "openFile")).toBe(
      true,
    );
    expect(items?.slice(2).every((item) => item.action === undefined)).toBe(true);

    const shiftedItems = computeComplianceChecklist({
      ...input,
      texSources: {
        "cap.tex": [
          "Linha nova acima",
          "%% TODO(matemática): reconstruir a equação",
          "%% TODO(rótulo inventado): conferir trecho raro",
        ].join("\n"),
      },
    }).find((check) => check.id === "importPdf")?.items;
    expect(shiftedItems?.map((item) => item.id)).toEqual(items?.map((item) => item.id));
  });

  it("ignores a hand-written marker in a project that never came from a PDF", () => {
    const texSources = {
      "cap.tex": "Texto\n%% TODO(matemática): reconstruir a equação",
    };

    // Sem relatório de importação não há procedência: o marcador é só um
    // comentário que o aluno escreveu, e a revisão de importação não existe.
    expect(
      computeComplianceChecklist(baseInput({ texSources, texOrder: ["cap.tex"] })).find(
        (check) => check.id === "importPdf",
      ),
    ).toBeUndefined();
    expect(
      computeComplianceChecklist(
        baseInput({ texSources, texOrder: ["cap.tex"], importUnclassified: [] }),
      ).find((check) => check.id === "importPdf")?.count,
    ).toBe(1);
  });

  it("keeps import item ids short even with a long marker excerpt", () => {
    const excerpt = "trecho muito longo ".repeat(40);
    const items = computeComplianceChecklist(
      baseInput({
        texSources: { "cap.tex": `%% TODO(matemática): ${excerpt}` },
        texOrder: ["cap.tex"],
        importUnclassified: [{ excerpt, page: 3 }],
      }),
    ).find((check) => check.id === "importPdf")?.items;

    expect(items).toHaveLength(2);
    for (const item of items ?? []) {
      expect(item.id.length).toBeLessThan(80);
      expect(item.id).not.toContain("trecho muito longo");
    }
  });

  it("never hands a removed marker's id to its surviving twin", () => {
    const twin = "%% TODO(matemática): reconstruir a equação";
    const idsOf = (source: string) =>
      computeComplianceChecklist(
        baseInput({
          texSources: { "cap.tex": source },
          texOrder: ["cap.tex"],
          importUnclassified: [],
        }),
      )
        .find((check) => check.id === "importPdf")
        ?.items?.map((item) => item.id) ?? [];

    const both = idsOf([twin, "Texto no meio", twin].join("\n"));
    expect(new Set(both).size).toBe(2);

    // Apagado o primeiro, o sobrevivente pode mudar de id — volta a "não
    // visitado", que é seguro —, mas não pode assumir o id do que sumiu.
    const survivor = idsOf(["Texto no meio", twin].join("\n"));
    expect(survivor).toHaveLength(1);
    expect(survivor[0]).not.toBe(both[0]);
  });

  it("keeps identical unclassified import entries as distinct items", () => {
    const repeated = {
      kind: "nao-classificado",
      excerpt: "Trecho repetido",
      page: 7,
    };
    const items = computeComplianceChecklist(
      baseInput({ importUnclassified: [repeated, repeated] }),
    ).find((check) => check.id === "importPdf")?.items;

    expect(items).toHaveLength(2);
    expect(new Set(items?.map((item) => item.id)).size).toBe(2);
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
    expect(orphans?.items?.every((item) => item.action === undefined)).toBe(true);
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
      check({ id: "pretextual", count: 5, action: { kind: "openGuide" } }),
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.action).toEqual({ kind: "openGuide" });
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
      check({ id: "pretextual", count: 5, action: { kind: "openGuide" } }),
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
