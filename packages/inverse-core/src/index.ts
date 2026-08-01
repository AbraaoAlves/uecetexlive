/**
 * Fachada do pipeline PDF → projeto uecetex2, sem tocar em disco.
 *
 * É a superfície que o navegador consome: entra o PDF em bytes e o esqueleto
 * do modelo em memória, sai o projeto pronto e um relatório honesto do que foi
 * reconhecido. Os três estágios continuam disponíveis em separado para o CLI e
 * para os testes.
 */
export { classify } from "./classify.js";
export { extract, extractIR, type ExtractResult } from "./extract.js";
export {
  emitFiles,
  type EmitFilesOptions,
  type EmitFilesResult,
  type EmitReport,
} from "./emit.js";
export { buildCiteIndex, countUnresolved, segmentCitations } from "./cite.js";
export type { DocumentIR } from "./ir.js";
export type { SemanticDoc } from "./semantic.js";

import { classify } from "./classify.js";
import { emitFiles, type EmitReport } from "./emit.js";
import { extract } from "./extract.js";
import type { DocumentIR } from "./ir.js";
import type { SemanticDoc } from "./semantic.js";

export interface ImportPdfResult {
  /** Projeto completo: caminho relativo → bytes. */
  files: Map<string, Uint8Array>;
  report: EmitReport;
  ir: DocumentIR;
  sem: SemanticDoc;
}

/** PDF + esqueleto do modelo → projeto em memória. */
export function importPdf(
  pdfBytes: Uint8Array,
  templateFiles: ReadonlyMap<string, Uint8Array>,
): ImportPdfResult {
  const { ir, assets } = extract(pdfBytes);
  const sem = classify(ir);
  const { files, report } = emitFiles(sem, { template: templateFiles, assets });
  return { files, report, ir, sem };
}
