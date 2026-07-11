/**
 * "Meu trabalho está certo?" (3.2 — §6 UI_UX_PLAN). Pure computation over
 * the project's already-extracted state — no I/O, no React. Each check
 * mirrors one bullet from the spec; the panel maps `id`+`status`+`count`
 * onto PT copy (strings.compliance), same aggregate-message pattern B6
 * uses for incomplete references.
 */
import {
  isKnownEntryType,
  isParseFailure,
  missingRequiredFields,
  parseBibFile,
} from "@papyru/bibliography";
import { extractCitedKeys } from "@/features/bibliography/citation-usage";
import { checkFigures } from "@/features/project/figures-checklist";
import type { MetadataField, WorkType } from "@/features/project/metadata";
import { TEMPLATE_PLACEHOLDER_TITLE } from "@/features/project/metadata";

export type CheckId =
  | "pretextual"
  | "abstract"
  | "references"
  | "figures"
  | "orphanCitations"
  | "uncitedEntries";

export type ComplianceAction =
  | { kind: "openMetadata" }
  | { kind: "openReferences" }
  | { kind: "openFile"; path: string };

export interface ComplianceCheck {
  id: CheckId;
  status: "ok" | "warn";
  /** How many things are wrong (missing fields, bad figures, orphan keys…) — drives singular/plural copy. */
  count: number;
  action?: ComplianceAction;
}

export interface ComplianceInput {
  meta: ReadonlyMap<string, MetadataField>;
  workType: WorkType | null;
  bibText: string | null;
  texSources: Record<string, string>;
  citeCommands: readonly string[];
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

function isUnfilled(macro: string, fields: ReadonlyMap<string, MetadataField>): boolean {
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
  if (bibText === null) return { id: "references", status: "ok", count: 0 };
  const file = parseBibFile(bibText);
  let incomplete = 0;
  for (const chunk of file.chunks) {
    if (chunk.kind !== "entry" || isParseFailure(chunk.parsed)) continue;
    const entry = chunk.parsed;
    if (!isKnownEntryType(entry.entryType)) continue;
    if (missingRequiredFields(entry.entryType, entry.fields).length > 0) incomplete++;
  }
  return {
    id: "references",
    status: incomplete === 0 ? "ok" : "warn",
    count: incomplete,
    action: { kind: "openReferences" },
  };
}

function checkFiguresAcrossProject(texSources: Record<string, string>): ComplianceCheck {
  let bad = 0;
  let firstBadPath: string | null = null;
  for (const [path, source] of Object.entries(texSources)) {
    for (const fig of checkFigures(source)) {
      if (!fig.hasCaption || !fig.hasFonte) {
        bad++;
        firstBadPath ??= path;
      }
    }
  }
  return {
    id: "figures",
    status: bad === 0 ? "ok" : "warn",
    count: bad,
    action: firstBadPath ? { kind: "openFile", path: firstBadPath } : undefined,
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
  return {
    id: "orphanCitations",
    status: orphans.length === 0 ? "ok" : "warn",
    count: orphans.length,
    action: { kind: "openReferences" },
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
  return {
    id: "uncitedEntries",
    status: uncited.length === 0 ? "ok" : "warn",
    count: uncited.length,
    action: { kind: "openReferences" },
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
  ];
}
