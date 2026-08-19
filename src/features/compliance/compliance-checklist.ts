/**
 * "Meu trabalho está certo?" — pure computation over the project's
 * already-extracted state, no I/O, no React. The panel maps
 * `id`+`status`+`count` onto PT copy (strings.compliance), the same
 * aggregate-message pattern the incomplete-references lint uses.
 */
import {
  type BibliographyEntry,
  isParseFailure,
  parseBibFile,
} from "@papyru/bibliography";
import { extractCitedKeys } from "@/features/bibliography/citation-usage";
import { formatAuthorsList } from "@/features/bibliography/format-authors";
import { incompleteEntriesOf } from "@/features/bibliography/missing-fields";
import { scanPendencyMarkers } from "@/features/import-pdf/pendency-markers";
import { pendencyLabelFor } from "@/features/import-pdf/report-summary";
import { checkFigures } from "@/features/project/figures-checklist";
import { orderedTexPaths } from "@/features/project/include-graph";
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
  | { kind: "openGuide" }
  /**
   * intent "focus": the key exists in the .bib — scroll to it and edit.
   * intent "search": the key was cited but has no entry, so there is no row to
   * focus; the useful destination is the search box pre-filled with it.
   */
  | { kind: "openReferences"; key?: string; intent?: "focus" | "search" }
  /** line is 1-based; mode says which editor to land in (default: keep current). */
  | { kind: "openFile"; path: string; line?: number; mode?: "source" | "visual" };

export type ComplianceReviewAction = {
  kind: "removePendencyMarker";
  path: string;
  line: number;
};

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
  /** Removes a live import marker after the student confirms the review. */
  reviewAction?: ComplianceReviewAction;
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
  /** Reading order from the include graph; files outside it follow alphabetically. */
  texOrder?: readonly string[];
  citeCommands: readonly string[];
  /** From the persisted report — only entries without a marker in the project. */
  importUnclassified?: readonly { kind?: string; excerpt: string; page: number }[];
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
    action: { kind: "openGuide" },
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
    action: { kind: "openGuide" },
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

function checkFiguresAcrossProject(
  texSources: Record<string, string>,
  texOrder: readonly string[],
): ComplianceCheck {
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

  // Ordem de leitura, não ordem do mapa de arquivos: a lista de figuras e a de
  // pendências de importação percorrem o mesmo trabalho e têm de percorrê-lo na
  // mesma sequência. Arquivo fora do grafo de `\input` entra depois, em ordem
  // alfabética — nunca fica de fora.
  for (const [fileOrder, path] of orderedTexPaths(texSources, texOrder).entries()) {
    const source = texSources[path];
    if (source === undefined) continue;
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

function bibEntriesOf(bibText: string | null): Map<string, BibliographyEntry> {
  if (bibText === null) return new Map();
  const entries = new Map<string, BibliographyEntry>();
  for (const chunk of parseBibFile(bibText).chunks) {
    if (chunk.kind === "entry" && !isParseFailure(chunk.parsed)) {
      entries.set(chunk.parsed.citationKey, chunk.parsed);
    }
  }
  return entries;
}

function bibKeysOf(bibText: string | null): Set<string> {
  return new Set(bibEntriesOf(bibText).keys());
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
  const known = bibEntriesOf(bibText);
  const uncited = [...known].filter(([key]) => !cited.has(key));
  const items: ComplianceItem[] = uncited.map(([key, entry]) => {
    const title = entry.fields.get("title")?.value.trim();
    const authors = formatAuthorsList(entry.fields.get("author")?.value);
    const year = entry.fields.get("year")?.value.trim();
    const detail = [authors, year].filter(Boolean).join(" · ");
    return {
      id: `uncitedEntries:${key}`,
      label: title || key,
      ...(detail ? { detail } : {}),
      action: {
        kind: "openReferences" as const,
        key,
        intent: "focus" as const,
      },
    };
  });
  return {
    id: "uncitedEntries",
    status: items.length === 0 ? "ok" : "warn",
    count: items.length,
    action: items[0]?.action,
    items,
  };
}

/**
 * O trecho do marcador é texto do trabalho — tamanho e conteúdo imprevisíveis —
 * e vai parar em `id` e `data-testid` do DOM. Entra resumido: o digest
 * identifica o mesmo trecho sem carregá-lo.
 *
 * FNV-1a de 32 bits, escrito à mão porque precisa ser estável entre execuções
 * (nada de hash interno do motor) e curto o bastante para um id.
 */
function digestOf(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function checkImportPdf(input: ComplianceInput): ComplianceCheck | null {
  // O relatório persistido da importação é o que diz que este projeto veio de
  // um PDF. Sem ele, um `%% TODO(...)` digitado à mão num projeto do modelo
  // abriria uma revisão de importação que nunca aconteceu.
  if (input.importUnclassified === undefined) return null;

  const scanned = scanPendencyMarkers(input.texSources, input.texOrder ?? []).map(
    (marker) => {
      const kind = typeof marker.kind === "string" ? marker.kind : marker.kind.other;
      return {
        marker,
        kind,
        idBase: `importPdf:marcador:${marker.path}:${kind}:${digestOf(marker.detail)}`,
      };
    },
  );
  // Marcadores gêmeos (mesmo arquivo, mesmo tipo, mesmo trecho) só se distinguem
  // pela linha. Numerá-los por ordem de aparição faria o sobrevivente herdar o
  // id do removido, e a lista o mostraria como já revisado sem que ninguém o
  // tivesse visto. Havendo empate, **todos** os empatados levam a linha no id: o
  // sobrevivente pode mudar de id — volta a "não visitado", que é seguro —, mas
  // nunca assume o id de outro.
  const twinIdBases = new Set(
    scanned
      .map(({ idBase }) => idBase)
      .filter((idBase, index, all) => all.indexOf(idBase) !== index),
  );
  const markerItems: ComplianceItem[] = scanned.map(({ marker, kind, idBase }) => ({
    id: twinIdBases.has(idBase) ? `${idBase}:l${marker.line}` : idBase,
    label: typeof marker.kind === "object" ? marker.kind.other : pendencyLabelFor(kind),
    detail: marker.detail,
    action: {
      kind: "openFile",
      path: marker.path,
      line: marker.line,
      mode: "source",
    },
    reviewAction: {
      kind: "removePendencyMarker",
      path: marker.path,
      line: marker.line,
    },
  }));

  // Estes vêm do relatório e só mudam numa nova importação; dois trechos
  // idênticos não têm como se distinguir, e aí a ordem de aparição basta.
  const excerptOccurrences = new Map<string, number>();
  const unclassifiedItems: ComplianceItem[] = input.importUnclassified.map(
    ({ kind = "nao-classificado", excerpt, page }) => {
      const help =
        kind === "nao-classificado"
          ? strings.compliance.importUnclassifiedHelp
          : strings.compliance.importLegacyHelp;
      const idBase = `importPdf:trecho:${kind}:${digestOf(excerpt)}:p${page}`;
      const occurrence = (excerptOccurrences.get(idBase) ?? 0) + 1;
      excerptOccurrences.set(idBase, occurrence);
      return {
        id: occurrence === 1 ? idBase : `${idBase}:${occurrence}`,
        label: pendencyLabelFor(kind),
        detail: `${excerpt} — p. ${page}. ${help}`,
      };
    },
  );
  const importItems = [...markerItems, ...unclassifiedItems];
  return {
    id: "importPdf",
    status: importItems.length > 0 ? "warn" : "ok",
    count: importItems.length,
    items: importItems,
  };
}

export function computeComplianceChecklist(input: ComplianceInput): ComplianceCheck[] {
  const importCheck = checkImportPdf(input);
  return [
    checkPretextual(input.meta, input.workType),
    checkAbstract(input.meta),
    checkReferences(input.bibText),
    checkFiguresAcrossProject(input.texSources, input.texOrder ?? []),
    checkOrphanCitations(input.texSources, input.citeCommands, input.bibText),
    checkUncitedEntries(input.texSources, input.citeCommands, input.bibText),
    ...(importCheck ? [importCheck] : []),
  ];
}
