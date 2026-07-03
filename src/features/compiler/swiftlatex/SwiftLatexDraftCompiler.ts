/**
 * Draft engine (§3.4): SwiftLaTeX pdfTeX ported verbatim from the prototype
 * (both patches live in the vendored engine files). One fast pass, on-demand
 * TL 2020 fetch; citations render as [?] — that is the product contract.
 */
import { parseLatexLog } from "../log-parser";
import type {
  CompileInput,
  CompileProgressFn,
  CompileResult,
  PdfCompiler,
  WarmupProgressFn,
} from "../types";

type SwiftLatexEngine = {
  loadEngine: () => Promise<void>;
  writeMemFSFile: (path: string, data: string | Uint8Array) => void;
  makeMemFSFolder: (folder: string) => void;
  setEngineMainFile: (path: string) => void;
  setTexliveEndpoint: (url: string) => void;
  compileLaTeX: () => Promise<{ status: number; pdf?: Uint8Array; log: string }>;
  closeWorker: () => void;
};

declare global {
  interface Window {
    PdfTeXEngine?: new () => SwiftLatexEngine;
  }
}

const ENGINE_SCRIPT_URL = "/wasm/swiftlatex/PdfTeXEngine.js";
const TEXLIVE_ENDPOINT = "/wasm/swiftlatex/texlive/"; // trailing slash matters

async function loadEngineScript(): Promise<NonNullable<typeof window.PdfTeXEngine>> {
  if (window.PdfTeXEngine) return window.PdfTeXEngine;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-uecetexlive-engine]",
    );
    const target =
      existing ??
      (() => {
        const script = document.createElement("script");
        script.src = ENGINE_SCRIPT_URL;
        script.async = true;
        script.dataset.uecetexliveEngine = "1";
        document.head.appendChild(script);
        return script;
      })();
    target.addEventListener("load", () => resolve());
    target.addEventListener("error", () =>
      reject(new Error(`Failed to load ${ENGINE_SCRIPT_URL}`)),
    );
  });
  const ctor = window.PdfTeXEngine;
  if (!ctor) throw new Error("PdfTeXEngine loaded but global is undefined");
  return ctor;
}

export class SwiftLatexDraftCompiler implements PdfCompiler {
  readonly id = "swiftlatex-draft" as const;

  private engine: SwiftLatexEngine | null = null;
  private warmupPromise: Promise<void> | null = null;

  warmup(onProgress?: WarmupProgressFn): Promise<void> {
    this.warmupPromise ??= this.doWarmup(onProgress).catch((err) => {
      this.warmupPromise = null;
      throw err;
    });
    return this.warmupPromise;
  }

  private async doWarmup(onProgress?: WarmupProgressFn): Promise<void> {
    onProgress?.(0, 1, "Carregando motor rascunho…");
    const EngineCtor = await loadEngineScript();
    this.engine = new EngineCtor();
    await this.engine.loadEngine();
    this.engine.setTexliveEndpoint(TEXLIVE_ENDPOINT);
    onProgress?.(1, 1, "Pronto");
  }

  async compile(
    input: CompileInput,
    onProgress?: CompileProgressFn,
  ): Promise<CompileResult> {
    const start = performance.now();
    await this.warmup();
    const engine = this.engine;
    if (!engine) throw new Error("draft engine not warmed up");

    onProgress?.(0.2, "Enviando arquivos…");
    const dirs = new Set<string>();
    for (const path of Object.keys(input.files)) {
      const parts = path.split("/").slice(0, -1);
      let acc = "";
      for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part;
        if (!dirs.has(acc)) {
          try {
            engine.makeMemFSFolder(acc);
          } catch {
            // folder may already exist
          }
          dirs.add(acc);
        }
      }
    }
    for (const [path, bytes] of Object.entries(input.files)) {
      engine.writeMemFSFile(path, bytes);
    }
    engine.setEngineMainFile(input.entry);

    onProgress?.(0.5, "Compilando (rascunho)…");
    try {
      const result = await engine.compileLaTeX();
      const parsed = parseLatexLog(result.log ?? "");
      const ok = result.status === 0 && !!result.pdf;
      onProgress?.(1, "Concluído");
      return {
        ok,
        pdf: result.pdf,
        log: result.log ?? "",
        diagnostics: parsed.diagnostics,
        passes: ["pdflatex(draft)"],
        durationMs: performance.now() - start,
      };
    } catch (err) {
      return {
        ok: false,
        log: `Engine error: ${(err as Error).message}`,
        diagnostics: [],
        passes: ["pdflatex(draft)"],
        durationMs: performance.now() - start,
      };
    }
  }

  async dispose(): Promise<void> {
    try {
      this.engine?.closeWorker();
    } catch {
      // ignore
    }
    this.engine = null;
    this.warmupPromise = null;
  }
}
