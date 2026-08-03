/**
 * Roda o worker do PDF e devolve o projeto pronto. Uma execução por chamada:
 * o worker é criado, usado e encerrado — sem estado entre importações.
 */
import type { EmitReport } from "@papyru/inverse-core";
import { strings } from "@/lib/strings";
import type { ImportPdfMessage, ImportStage } from "./protocol";

export interface ImportPdfOutcome {
  files: Map<string, Uint8Array>;
  report: EmitReport;
}

const IMPORT_TIMEOUT_MS = 120_000;

/** O PDF não tem o perfil do modelo; o chamador decide se insiste. */
export class LowConfidenceError extends Error {
  constructor(readonly bodyFraction: number) {
    super("perfil do PDF não confere com o modelo");
    this.name = "LowConfidenceError";
  }
}

export function runPdfImport(
  pdf: Uint8Array,
  template: ReadonlyMap<string, Uint8Array>,
  onProgress?: (stage: ImportStage, pct: number) => void,
  force = false,
): Promise<ImportPdfOutcome> {
  const worker = new Worker(new URL("./inverse.worker.ts", import.meta.url), {
    type: "module",
  });
  return new Promise<ImportPdfOutcome>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      worker.terminate();
      reject(new Error(strings.importPdf.errorResources));
    }, IMPORT_TIMEOUT_MS);
    const finish = () => {
      window.clearTimeout(timeoutId);
      worker.terminate();
    };
    worker.onmessage = (event: MessageEvent<ImportPdfMessage>) => {
      const message = event.data;
      if (message.type === "progress") return onProgress?.(message.stage, message.pct);
      finish();
      if (message.type === "error") reject(new Error(message.message));
      else if (message.type === "low-confidence")
        reject(new LowConfidenceError(message.bodyFraction));
      else resolve({ files: new Map(message.files), report: message.report });
    };
    worker.onmessageerror = () => {
      finish();
      reject(new Error(strings.importPdf.errorResources));
    };
    // Estouro de memória do WASM chega aqui como erro do worker, sem mensagem
    // aproveitável — melhor uma explicação em português do que a tela branca.
    worker.onerror = () => {
      finish();
      reject(new Error(strings.importPdf.errorResources));
    };
    const payload = [...template.entries()];
    worker.postMessage({ pdf, template: payload, force }, [pdf.buffer]);
  });
}
