/**
 * Máquina de estados de compilação, pura (§ do plano de extração): engine
 * dual sobre getCompiler(engineId) + compile(). Sem persistência, sem saber
 * o que é um Project — o app decide o que fazer com o resultado (ex.:
 * cachear o último PDF).
 */
import { useCallback, useRef, useState } from "react";
import { type EngineId, getCompiler } from "../index";
import type { CompileResult } from "../types";

export type CompileStatus = "idle" | "warming" | "compiling" | "ok" | "error";

export interface CompilerEngineState {
  status: CompileStatus;
  engine: EngineId;
  warmup: { loaded: number; total: number; label: string } | null;
  progress: { fraction: number; label: string } | null;
  result: CompileResult | null;
  error: string | null;
}

export interface UseCompilerEngineOptions {
  /** Base URL (com barra final) dos assets estáticos de cada engine. */
  assetBaseUrls: Record<EngineId, string>;
  initialEngine?: EngineId;
}

export interface CompileRequest {
  entry: string;
  files: Record<string, Uint8Array>;
  engine?: EngineId;
  precompiledBbl?: Uint8Array;
}

export function useCompilerEngine({
  assetBaseUrls,
  initialEngine = "swiftlatex-draft",
}: UseCompilerEngineOptions) {
  const [state, setState] = useState<CompilerEngineState>({
    status: "idle",
    engine: initialEngine,
    warmup: null,
    progress: null,
    result: null,
    error: null,
  });
  const busy = useRef(false);
  const assetBaseUrlsRef = useRef(assetBaseUrls);
  assetBaseUrlsRef.current = assetBaseUrls;

  const setEngine = useCallback((engine: EngineId) => {
    setState((prev) => ({ ...prev, engine }));
  }, []);

  const compile = useCallback(
    async (request: CompileRequest): Promise<CompileResult | null> => {
      if (busy.current) return null;
      busy.current = true;
      const engine = request.engine ?? state.engine;
      try {
        setState((prev) => ({
          ...prev,
          engine,
          status: "warming",
          warmup: null,
          error: null,
        }));
        const compiler = await getCompiler(engine, assetBaseUrlsRef.current[engine]);
        await compiler.warmup((loaded, total, label) => {
          setState((prev) => ({ ...prev, warmup: { loaded, total, label } }));
        });

        setState((prev) => ({
          ...prev,
          status: "compiling",
          warmup: null,
          progress: { fraction: 0, label: "Compilando…" },
        }));
        const result = await compiler.compile(
          {
            entry: request.entry,
            files: request.files,
            mode: engine === "busytex-full" ? "full" : "draft",
            precompiledBbl: request.precompiledBbl,
          },
          (fraction, label) => {
            setState((prev) => ({ ...prev, progress: { fraction, label } }));
          },
        );

        setState((prev) => ({
          ...prev,
          status: result.ok ? "ok" : "error",
          progress: null,
          result,
        }));
        return result;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: "error",
          progress: null,
          warmup: null,
          error: (err as Error).message,
        }));
        return null;
      } finally {
        busy.current = false;
      }
    },
    [state.engine],
  );

  return { state, compile, setEngine };
}
