/**
 * Adapter do app (D12): o warmup ocioso aquece só o busytex-full, com os
 * assets deste app; a lógica vive em @uecetexlive/compiler/react.
 */
import {
  type IdleWarmupState,
  useIdleWarmup as usePackageIdleWarmup,
} from "@uecetexlive/compiler/react";
import { getCompiler } from "./index";

export type { IdleWarmupState };

export function useIdleWarmup(): IdleWarmupState {
  return usePackageIdleWarmup({ getCompiler: () => getCompiler("busytex-full") });
}
