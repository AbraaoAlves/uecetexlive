/**
 * Lazy factory (§3.2). The engine module is client-only, loaded via dynamic
 * import() from event handlers — never from route module graphs.
 *
 * Draft and full share the single busytex instance (same worker, same
 * one-time ~220 MB warmup); the mode is decided per compile via
 * CompileInput.mode.
 */
import type { PdfCompiler } from "./types";

let cached: Promise<PdfCompiler> | null = null;

export function getCompiler(): Promise<PdfCompiler> {
  cached ??= import("./busytex/BusytexCompiler").then((m) => new m.BusytexCompiler());
  return cached;
}

export type * from "./types";
