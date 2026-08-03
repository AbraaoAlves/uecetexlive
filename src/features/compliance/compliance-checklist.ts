/**
 * "Meu trabalho está certo?" — pure computation over the project's
 * already-extracted state, no I/O, no React. The panel maps
 * `id`+`status`+`count` onto PT copy (strings.compliance), the same
 * aggregate-message pattern the incomplete-references lint uses.
 */
import { isParseFailure, parseBibFile } from "@papyru/bibliography";
import { extractCitedKeys } from "@/features/bibliography/citation-usage";
import { incompleteEntriesOf } from "@/features/bibliography/missing-fields";
import { checkFigures } from "@/features/project/figures-checklist";
import type { MetadataField, WorkType } from "@/features/project/metadata";
import { TEMPLATE_PLACEHOLDER_TITLE } from "@/features/project/metadata";
import { strings } from "@/lib/strings";

export type CheckId =
  | "pretextual"
  | "abstract"
  | "references"
  | "figures"
  | "orphanCitations"
  | "uncitedEntries"
  | "importPdf";

export type ComplianceAction =
  | { kind: "openMetadata" }
  /**
   * intent "focus": the key exists in the .bib — scroll to it and edit.
   * intent "search": the key was cited but has no entry, so there is no row to
   * focus; the useful destination is the search box pre-filled with it.
   */
  | { kind: "openReferences"; key?: string; intent?: "focus" | "search" }
  /** line is 1-based; mode says which editor to land in (default: keep current). */
  | { kind: "openFile"; path: string; line?: number; mode?: "source" | "visual" };

/** One concrete thing to fix, inside a check that knows how to enumerate. */
export interface ComplianceItem {
  /** Stable across recomputes — React key, and how "next item" avoids repeats. */
  id: string;
  label: string;
  /** What's missing ("sem legenda", "p. 34") — shown under the label. */
  detail?: string;
  /** Tells apart reasons within one check (2.2: no caption × no source). */
  reason?: string;
  /** Absent = nowhere to navigate (an unclassified PDF excerpt has no home). */
  action?: ComplianceAction;
}

export interface ComplianceCheck {
  id: CheckId;
  status: "ok" | "warn";
  /** How many things are wrong (missing fields, bad figures, orphan keys…) — drives singular/plural copy. */
  count: number;
  action?: ComplianceAction;
  /** Present only where the check can name its offenders one by one. */
  items?: readonly ComplianceItem[];
}

/**
 * Checks that can't enumerate (pré-textuais, resumo) still have to take their
 * turn in the badge and in "corrigir o próximo" — so they stand in for
 * themselves with a single item carrying the check's own action. The stand-in
 * is for counting and walking, not for display: `label` is the check id, and a
 * check with no `items` renders its own PT copy instead of a row.
 */
export function effectiveItems(check: ComplianceCheck): readonly ComplianceItem[] {
  if (check.status === "ok") return [];
  if (check.items) return check.items;
  return [{ id: check.id, label: check.id, action: check.action }];
}

export function pendingItemCount(checks: readonly ComplianceCheck[]): number {
  return checks.reduce((total, check) => total + effectiveItems(check).length, 0);
}

export interface ComplianceInput {
  meta: ReadonlyMap<string, MetadataField>;
  workType: WorkType | null;
  bibText: string | null;
  texSources: Record<string, string>;
  citeCommands: readonly string[];
  /**
   * Pendências da importação de PDF, se o projeto veio por esse caminho.
   * Ficam aqui porque é a lista que o aluno consulta para saber o que ainda
   * tem de refazer — e ela precisa sobreviver ao recarregamento.
   */
  importPendencies?: number;
}

/** Shipped template defaults — a field still equal to these was never touched. */
const PLACEHOLDER_VALUES: Partial<Record<string, string>> = {
  titulo: TEMPLATE_PLACEHOLDER_TITLE,
  autor: "Nome Sobrenome",
  orientador: "Nome do seu Orientador",
  data: "2017",
  graduacaoem: "Ciência da Computação",
  especializacaoem: "Alfabetização de Crianças",
  programamestrado: "Programa de Pós-Graduação em Ciência da Computação",
  nomedomestrado: "Mestrado Acadêmico em Ciência da Computação",
  programadoutorado: "Programa de Pós-Graduação em Saúde Coletiva",
  nomedodoutorado: "Doutorado em Saúde Coletiva",
};

const BASE_REQUIRED = ["titulo", "autor", "orientador", "data"];
const REQUIRED_BY_TYPE: Record<WorkType, readonly string[]> = {
  tccgraduacao: ["graduacaoem"],
  tccespecializacao: ["especializacaoem"],
  dissertacao: ["programamestrado", "nomedomestrado"],
  tese: ["programadoutorado", "nomedodoutorado"],
};

/**
 * Vazio, ou ainda com o exemplo que o modelo semeia. Exportado porque o guia
 * do trabalho precisa da MESMA régua: "Nome Sobrenome" não é um autor.
 */
export function isUnfilled(
  macro: string,
  fields: ReadonlyMap<string, MetadataField>,
): boolean {
  const value = fields.get(macro)?.value.trim();
  if (value === undefined || value === "") return true;
  return value === PLACEHOLDER_VALUES[macro];
}

function checkPretextual(
  meta: ReadonlyMap<string, MetadataField>,
  workType: WorkType | null,
): ComplianceCheck {
  const required = [...BASE_REQUIRED, ...(workType ? REQUIRED_BY_TYPE[workType] : [])];
  const unfilled = required.filter((macro) => isUnfilled(macro, meta));
  return {
    id: "pretextual",
    status: unfilled.length === 0 ? "ok" : "warn",
    count: unfilled.length,
    action: { kind: "openMetadata" },
  };
}

// The instructional placeholder paragraph itself is the "unedited" signal
// (same file, same string, both languages — see resumo.tex/abstract.tex).
const RESUMO_PLACEHOLDER_MARKER = "Substitua este parágrafo pelo texto do seu resumo";
const ABSTRACT_PLACEHOLDER_MARKER = "Replace this paragraph with your abstract";

function checkAbstract(meta: ReadonlyMap<string, MetadataField>): ComplianceCheck {
  const resumoBody = meta.get("resumobody")?.value;
  const abstractBody = meta.get("abstractbody")?.value;
  const missing =
    resumoBody === undefined ||
    abstractBody === undefined ||
    resumoBody.includes(RESUMO_PLACEHOLDER_MARKER) ||
    abstractBody.includes(ABSTRACT_PLACEHOLDER_MARKER);
  return {
    id: "abstract",
    status: missing ? "warn" : "ok",
    count: missing ? 1 : 0,
    action: { kind: "openMetadata" },
  };
}

function checkReferences(bibText: string | null): ComplianceCheck {
  const incomplete = incompleteEntriesOf(bibText);
  const items: ComplianceItem[] = incomplete.map(({ key, missing }) => ({
    id: `references:${key}`,
    label: key,
    detail: strings.compliance.referenceMissingFields.replace(
      "{fields}",
      missing.join(", "),
    ),
    ...(bibText === null
      ? {}
      : {
          action: {
            kind: "openReferences" as const,
            key,
            intent: "focus" as const,
          },
        }),
  }));
  return {
    id: "references",
    status: items.length === 0 ? "ok" : "warn",
    count: items.length,
    action: items[0]?.action,
    items,
  };
}

function checkFiguresAcrossProject(texSources: Record<string, string>): ComplianceCheck {
  type FigureReason = "sem-legenda" | "sem-fonte" | "sem-legenda-e-fonte";
  const reasonOrder: Record<FigureReason, number> = {
    "sem-legenda-e-fonte": 0,
    "sem-legenda": 1,
    "sem-fonte": 2,
  };
  const pending: Array<{
    item: ComplianceItem;
    reasonOrder: number;
    fileOrder: number;
    line: number;
  }> = [];

  for (const [fileOrder, [path, source]] of Object.entries(texSources).entries()) {
    for (const fig of checkFigures(source)) {
      if (fig.hasCaption && fig.hasFonte) continue;

      const reason: FigureReason =
        !fig.hasCaption && !fig.hasFonte
          ? "sem-legenda-e-fonte"
          : !fig.hasCaption
            ? "sem-legenda"
            : "sem-fonte";
      const detail =
        reason === "sem-legenda-e-fonte"
          ? strings.compliance.figureNoBoth
          : reason === "sem-legenda"
            ? strings.compliance.figureNoCaption
            : strings.compliance.figureNoFonte;
      const fileName = path.split("/").at(-1) || path;
      const fallbackLabel = strings.compliance.figureFallbackLabel
        .replace("{n}", String(fig.index + 1))
        .replace("{file}", fileName);
      const action: ComplianceAction = {
        kind: "openFile",
        path,
        line: fig.line,
        mode: "source",
      };
      pending.push({
        item: {
          id: `${path}:${fig.index}`,
          label: fig.caption ?? fallbackLabel,
          detail,
          reason,
          action,
        },
        reasonOrder: reasonOrder[reason],
        fileOrder,
        line: fig.line,
      });
    }
  }

  const items = pending
    .sort(
      (left, right) =>
        left.reasonOrder - right.reasonOrder ||
        left.fileOrder - right.fileOrder ||
        left.line - right.line,
    )
    .map(({ item }) => item);
  return {
    id: "figures",
    status: items.length === 0 ? "ok" : "warn",
    count: items.length,
    action: items[0]?.action,
    items,
  };
}

function bibKeysOf(bibText: string | null): Set<string> {
  if (bibText === null) return new Set();
  const keys = new Set<string>();
  for (const chunk of parseBibFile(bibText).chunks) {
    if (chunk.kind === "entry" && !isParseFailure(chunk.parsed)) {
      keys.add(chunk.parsed.citationKey);
    }
  }
  return keys;
}

function checkOrphanCitations(
  texSources: Record<string, string>,
  citeCommands: readonly string[],
  bibText: string | null,
): ComplianceCheck {
  const cited = extractCitedKeys(texSources, citeCommands);
  const known = bibKeysOf(bibText);
  const orphans = [...cited].filter((k) => !known.has(k));
  const items: ComplianceItem[] = orphans.map((key) => ({
    id: `orphanCitations:${key}`,
    label: key,
    ...(bibText === null
      ? {}
      : {
          action: {
            kind: "openReferences" as const,
            key,
            intent: "search" as const,
          },
        }),
  }));
  return {
    id: "orphanCitations",
    status: items.length === 0 ? "ok" : "warn",
    count: items.length,
    // Sem .bib no projeto não há para onde levar o aluno — oferecer "corrigir"
    // que não faz nada é pior do que não oferecer. Criar o arquivo do zero é
    // outro pedido.
    action: items[0]?.action,
    items,
  };
}

function checkUncitedEntries(
  texSources: Record<string, string>,
  citeCommands: readonly string[],
  bibText: string | null,
): ComplianceCheck {
  const cited = extractCitedKeys(texSources, citeCommands);
  const known = bibKeysOf(bibText);
  const uncited = [...known].filter((k) => !cited.has(k));
  const items: ComplianceItem[] = uncited.map((key) => ({
    id: `uncitedEntries:${key}`,
    label: key,
    ...(bibText === null
      ? {}
      : {
          action: {
            kind: "openReferences" as const,
            key,
            intent: "focus" as const,
          },
        }),
  }));
  return {
    id: "uncitedEntries",
    status: items.length === 0 ? "ok" : "warn",
    count: items.length,
    action: items[0]?.action,
    items,
  };
}

export function computeComplianceChecklist(input: ComplianceInput): ComplianceCheck[] {
  return [
    checkPretextual(input.meta, input.workType),
    checkAbstract(input.meta),
    checkReferences(input.bibText),
    checkFiguresAcrossProject(input.texSources),
    checkOrphanCitations(input.texSources, input.citeCommands, input.bibText),
    checkUncitedEntries(input.texSources, input.citeCommands, input.bibText),
    ...(input.importPendencies === undefined
      ? []
      : [
          {
            id: "importPdf" as const,
            status: (input.importPendencies > 0 ? "warn" : "ok") as "ok" | "warn",
            count: input.importPendencies,
          },
        ]),
  ];
}
