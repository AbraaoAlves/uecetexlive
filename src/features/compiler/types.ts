/**
 * PdfCompiler contract (§3.2) — one interface, one engine (busytex), two
 * modes (draft = single pdflatex pass, full = fixpoint). UI code never
 * knows which ran beyond the mode it asked for.
 */
export interface CompileInput {
  entry: string;
  /** Full project VFS, paths relative to root. */
  files: Record<string, Uint8Array>;
  mode: "draft" | "full";
  /** Present when the user imported a precompiled .bbl (§3.6 Tier 4). */
  precompiledBbl?: Uint8Array;
}

export interface CompileDiagnostic {
  severity: "error" | "warning";
  file?: string;
  /** 1-based, in `file`. */
  line?: number;
  message: string;
  rawLogExcerpt: string;
}

export interface CompileResult {
  ok: boolean;
  pdf?: Uint8Array;
  log: string;
  diagnostics: CompileDiagnostic[];
  /** e.g. ["pdflatex","bibtex8","makeindex:glo","makeindex:idx","pdflatex","pdflatex"] */
  passes: string[];
  durationMs: number;
}

export type WarmupProgressFn = (loaded: number, total: number, label: string) => void;
export type CompileProgressFn = (fraction: number, label: string) => void;

export interface PdfCompiler {
  readonly id: "busytex";
  /** Resolves when engine + data are loaded; reports download progress. */
  warmup(onProgress?: WarmupProgressFn): Promise<void>;
  compile(input: CompileInput, onProgress?: CompileProgressFn): Promise<CompileResult>;
  dispose(): Promise<void>;
}
