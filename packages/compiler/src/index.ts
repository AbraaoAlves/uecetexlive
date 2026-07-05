/**
 * Lazy factory per engine id (§3.2). Engine modules are client-only, loaded
 * via dynamic import() from event handlers — never from route module graphs.
 *
 * Onde os assets de cada engine moram é decisão do app consumidor: o
 * assetBaseUrl chega por parâmetro (por engine — os dois motores podem ser
 * servidos de caminhos diferentes) e vai ao construtor certo. Nenhum
 * import.meta.env dentro do pacote.
 */
import type { PdfCompiler } from "./types";

export type EngineId = PdfCompiler["id"];

const cache = new Map<string, Promise<PdfCompiler>>();

export function getCompiler(id: EngineId, assetBaseUrl: string): Promise<PdfCompiler> {
  const key = `${id}@${assetBaseUrl}`;
  let cached = cache.get(key);
  if (!cached) {
    cached =
      id === "busytex-full"
        ? import("./busytex/BusytexFullCompiler").then(
            (m) => new m.BusytexFullCompiler(assetBaseUrl),
          )
        : import("./swiftlatex/SwiftLatexDraftCompiler").then(
            (m) => new m.SwiftLatexDraftCompiler(assetBaseUrl),
          );
    cache.set(key, cached);
  }
  return cached;
}

export { parseLatexLog } from "./log-parser";
export { type OrchestratorIO, runFullBuild } from "./orchestrator";
export type * from "./types";
