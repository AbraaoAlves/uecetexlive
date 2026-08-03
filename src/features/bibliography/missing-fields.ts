/**
 * A régua de "esta referência está incompleta" — uma só, em módulo puro,
 * porque três superfícies precisam dela e discordar entre elas seria pior do
 * que não avisar: a lista de referências, o resumo da barra do editor e o
 * checklist de conformidade.
 */
import {
  type BibliographyEntry,
  ENTRY_FIELD_SPECS,
  isKnownEntryType,
  isParseFailure,
  missingRequiredFields,
  parseBibFile,
} from "@papyru/bibliography";

/** Campos obrigatórios que faltam, já com o rótulo em português. */
export function missingFieldLabelsFor(entry: BibliographyEntry): string[] {
  if (!isKnownEntryType(entry.entryType)) return [];
  const specs = ENTRY_FIELD_SPECS[entry.entryType];
  return missingRequiredFields(entry.entryType, entry.fields).map(
    (name) => specs.find((s) => s.name === name)?.labelPt ?? name,
  );
}

export interface IncompleteEntry {
  key: string;
  /** Rótulos PT dos campos que faltam — nunca vazio. */
  missing: string[];
}

/** Toda entrada do .bib, na ordem do arquivo, com o que falta em cada uma. */
export function incompleteEntriesOf(bibText: string | null): IncompleteEntry[] {
  if (bibText === null) return [];
  const out: IncompleteEntry[] = [];
  for (const chunk of parseBibFile(bibText).chunks) {
    if (chunk.kind !== "entry" || isParseFailure(chunk.parsed)) continue;
    const missing = missingFieldLabelsFor(chunk.parsed);
    if (missing.length > 0) out.push({ key: chunk.parsed.citationKey, missing });
  }
  return out;
}

/** Quantas entradas o .bib tem (só as que o parser entendeu). */
export function entryCountOf(bibText: string | null): number {
  if (bibText === null) return 0;
  let count = 0;
  for (const chunk of parseBibFile(bibText).chunks) {
    if (chunk.kind === "entry" && !isParseFailure(chunk.parsed)) count++;
  }
  return count;
}
