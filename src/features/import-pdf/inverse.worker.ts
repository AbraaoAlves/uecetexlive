/**
 * Worker do caminho PDF → projeto.
 *
 * O `import("@papyru/inverse-core")` é dinâmico e acontece AQUI dentro: o WASM
 * do leitor de PDF (~3,4 MB comprimido) só é baixado quando o aluno importa um
 * PDF, nunca no carregamento do app.
 */
import { assessConfidence } from "./confidence";
import type { ImportPdfMessage, ImportPdfRequest } from "./protocol";

function post(message: ImportPdfMessage, transfer: Transferable[] = []): void {
  self.postMessage(message, transfer);
}

self.onmessage = async (event: MessageEvent<ImportPdfRequest>) => {
  const { pdf, template, force } = event.data;
  try {
    post({ type: "progress", stage: "lendo", pct: 0 });
    const { classify, emitFiles, extract } = await import("@papyru/inverse-core");

    const { ir, assets } = extract(pdf);
    // Antes de reconhecer: o PDF tem a assinatura do modelo? Um arquivo de
    // outra origem atravessa o pipeline sem erro e produz um projeto ruim.
    const confidence = assessConfidence(ir);
    if (!confidence.ok && !force) {
      post({
        type: "low-confidence",
        bodyFraction: confidence.bodyFraction,
        hasOutline: confidence.hasOutline,
      });
      return;
    }
    post({ type: "progress", stage: "reconhecendo", pct: 0.45 });

    const sem = classify(ir);
    post({ type: "progress", stage: "montando", pct: 0.8 });

    const { files, report } = emitFiles(sem, { template: new Map(template), assets });
    const payload = [...files.entries()];
    post(
      { type: "done", files: payload, report },
      payload.map(([, bytes]) => bytes.buffer),
    );
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
