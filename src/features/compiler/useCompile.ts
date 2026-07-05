/**
 * Compile do app: delega a máquina de estados ao useCompilerEngine do
 * pacote e adiciona o que é responsabilidade deste app — montar o VFS a
 * partir do Project e cachear o último PDF (IndexedDB).
 */
import type { EngineId } from "@uecetexlive/compiler";
import { type CompilerEngineState, useCompilerEngine } from "@uecetexlive/compiler/react";
import type { Project } from "@uecetexlive/project-model";
import { useCallback } from "react";
import { cacheLastPdf } from "@/features/persistence/db";
import { ENGINE_ASSET_BASES } from "./index";

export type { CompileStatus } from "@uecetexlive/compiler/react";
export type { EngineId };
export type CompileState = CompilerEngineState;

export function useCompile() {
  const {
    state,
    compile: engineCompile,
    setEngine,
  } = useCompilerEngine({ assetBaseUrls: ENGINE_ASSET_BASES });

  const compile = useCallback(
    async (
      project: Project,
      options?: { engine?: EngineId; precompiledBbl?: Uint8Array },
    ) => {
      const files: Record<string, Uint8Array> = {};
      for (const f of project.files) files[f.path] = f.bytes;
      const result = await engineCompile({
        entry: project.entry,
        files,
        engine: options?.engine,
        precompiledBbl: options?.precompiledBbl,
      });
      if (result?.ok && result.pdf) {
        void cacheLastPdf({
          pdf: result.pdf,
          passes: result.passes,
          timestamp: Date.now(),
        }).catch(() => {});
      }
    },
    [engineCompile],
  );

  return { state, compile, setEngine };
}
