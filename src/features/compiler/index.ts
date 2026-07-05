/**
 * Adapter do app: os assets de cada engine são servidos dos estáticos deste
 * app (BASE_URL do Vite, subpath no GitHub Pages). O pacote
 * @uecetexlive/compiler recebe o caminho por parâmetro — nunca lê
 * import.meta.env.
 */
import {
  type EngineId,
  getCompiler as getPackageCompiler,
  type PdfCompiler,
} from "@uecetexlive/compiler";

export const ENGINE_ASSET_BASES: Record<EngineId, string> = {
  "busytex-full": `${import.meta.env.BASE_URL}wasm/busytex/`,
  "swiftlatex-draft": `${import.meta.env.BASE_URL}wasm/swiftlatex/`,
};

export function getCompiler(id: EngineId): Promise<PdfCompiler> {
  return getPackageCompiler(id, ENGINE_ASSET_BASES[id]);
}

export type * from "@uecetexlive/compiler";
