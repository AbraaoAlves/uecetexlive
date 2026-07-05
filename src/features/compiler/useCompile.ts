/**
 * Page-side compile state machine. Engine modules load lazily on first use
 * (client-only discipline, §3.2).
 */
import { useCallback, useRef, useState } from "react";
import { cacheLastPdf } from "@/features/persistence/db";
import type { Project } from "@/features/project/schema";
import { getCompiler } from "./index";
import type { CompileResult } from "./types";

export type CompileStatus = "idle" | "warming" | "compiling" | "ok" | "error";
export type EngineId = "busytex-draft" | "busytex-full";

export interface CompileState {
  status: CompileStatus;
  engine: EngineId;
  warmup: { loaded: number; total: number; label: string } | null;
  progress: { fraction: number; label: string } | null;
  result: CompileResult | null;
  error: string | null;
}

const initial: CompileState = {
  status: "idle",
  engine: "busytex-draft",
  warmup: null,
  progress: null,
  result: null,
  error: null,
};

export function useCompile() {
  const [state, setState] = useState<CompileState>(initial);
  const busy = useRef(false);

  const setEngine = useCallback((engine: EngineId) => {
    setState((prev) => ({ ...prev, engine }));
  }, []);

  const compile = useCallback(
    async (
      project: Project,
      options?: { engine?: EngineId; precompiledBbl?: Uint8Array },
    ) => {
      if (busy.current) return;
      busy.current = true;
      const engine = options?.engine ?? state.engine;
      try {
        setState((prev) => ({
          ...prev,
          engine,
          status: "warming",
          warmup: null,
          error: null,
        }));
        const compiler = await getCompiler();
        await compiler.warmup((loaded, total, label) => {
          setState((prev) => ({ ...prev, warmup: { loaded, total, label } }));
        });

        setState((prev) => ({
          ...prev,
          status: "compiling",
          warmup: null,
          progress: { fraction: 0, label: "Compilando…" },
        }));
        const files: Record<string, Uint8Array> = {};
        for (const f of project.files) files[f.path] = f.bytes;

        const result = await compiler.compile(
          {
            entry: project.entry,
            files,
            mode: engine === "busytex-full" ? "full" : "draft",
            precompiledBbl: options?.precompiledBbl,
          },
          (fraction, label) => {
            setState((prev) => ({ ...prev, progress: { fraction, label } }));
          },
        );

        if (result.ok && result.pdf) {
          void cacheLastPdf({
            pdf: result.pdf,
            passes: result.passes,
            timestamp: Date.now(),
          }).catch(() => {});
        }
        setState((prev) => ({
          ...prev,
          status: result.ok ? "ok" : "error",
          progress: null,
          result,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: "error",
          progress: null,
          warmup: null,
          error: (err as Error).message,
        }));
      } finally {
        busy.current = false;
      }
    },
    [state.engine],
  );

  return { state, compile, setEngine };
}
