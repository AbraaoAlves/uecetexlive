/**
 * The busytex engine (§3.3): pdflatex + bibtex8 + makeindex driven by the
 * pure orchestrator, executed inside a classic worker
 * (public/wasm/busytex/uecetexlive.worker.js). Serves both compile modes:
 * "draft" runs a single pdflatex pass (runDraftBuild), "full" runs the
 * complete fixpoint (runFullBuild).
 *
 * warmup() prefetches every asset with byte progress (the ~220 MB moment —
 * §6.3; ≈160 MB on the wire via the D12 gzip sidecars); the worker's
 * importScripts/fetch then hit the HTTP cache.
 */
import { runDraftBuild, runFullBuild } from "../orchestrator";
import type {
  CompileInput,
  CompileProgressFn,
  CompileResult,
  PdfCompiler,
  WarmupProgressFn,
} from "../types";

// BASE_URL-prefixed: subpath deploys (GitHub Pages) serve wasm under the base.
const BASE = `${import.meta.env.BASE_URL}wasm/busytex/`;

/** Order matters: mounted in sequence; extra overrides earlier trees. */
export const DATA_PACKAGES = [
  "texlive-basic.js",
  "ubuntu-texlive-latex-base.js",
  "ubuntu-texlive-latex-recommended.js",
  "ubuntu-texlive-latex-extra.js",
  "ubuntu-texlive-fonts-recommended.js",
  "ubuntu-texlive-science.js",
];

interface WorkerReply {
  id: number;
  ok: boolean;
  error?: string;
  stack?: string;
  [key: string]: unknown;
}

interface ManifestAsset {
  name: string;
  size: number;
}

async function fetchWithProgress(
  url: string,
  onChunk: (bytes: number) => void,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  if (!res.body) return;
  const reader = res.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) onChunk(value.byteLength);
  }
}

export class BusytexCompiler implements PdfCompiler {
  readonly id = "busytex" as const;

  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, (reply: WorkerReply) => void>();
  private warmupPromise: Promise<void> | null = null;
  private warmupDone = false;
  private warmupListeners = new Set<WarmupProgressFn>();
  private lastWarmupEvent: [number, number, string] | null = null;
  private injectFiles: { path: string; bytes: ArrayBuffer }[] = [];

  // Warmup can have two watchers at once (the idle prefetch indicator and a
  // compile started mid-download — D12), so progress fans out to a listener
  // set; late subscribers are caught up with the last event.
  warmup(onProgress?: WarmupProgressFn): Promise<void> {
    if (onProgress && !this.warmupDone) {
      this.warmupListeners.add(onProgress);
      if (this.lastWarmupEvent) onProgress(...this.lastWarmupEvent);
    }
    this.warmupPromise ??= this.doWarmup((loaded, total, label) => {
      this.lastWarmupEvent = [loaded, total, label];
      for (const listener of this.warmupListeners) listener(loaded, total, label);
    })
      .then(() => {
        this.warmupDone = true;
        this.warmupListeners.clear();
      })
      .catch((err) => {
        this.warmupPromise = null; // allow retry
        throw err;
      });
    return this.warmupPromise;
  }

  private async doWarmup(onProgress?: WarmupProgressFn): Promise<void> {
    const manifest: { files: ManifestAsset[] } = await (
      await fetch(`${BASE}manifest.json`)
    ).json();

    const runtimeAssets = manifest.files.filter(
      (f) =>
        f.name === "busytex.js" ||
        f.name === "busytex.wasm" ||
        f.name === "busytex_pipeline.js" ||
        DATA_PACKAGES.includes(f.name) ||
        f.name.endsWith(".data"),
    );
    const total = runtimeAssets.reduce((sum, f) => sum + f.size, 0);
    let loaded = 0;

    // 4-way parallel fetch: good saturation without hammering the host.
    const queue = [...runtimeAssets];
    const workers = Array.from({ length: 4 }, async () => {
      while (true) {
        const asset = queue.shift();
        if (!asset) return;
        await fetchWithProgress(BASE + asset.name, (n) => {
          loaded += n;
          onProgress?.(loaded, total, asset.name);
        });
      }
    });
    await Promise.all(workers);

    // abnTeX2 injection pack (risk K1 — DEVIATIONS.md D2).
    const injectNames: string[] = await (
      await fetch(`${BASE}inject/manifest.json`)
    ).json();
    this.injectFiles = await Promise.all(
      injectNames.map(async (name) => ({
        path: name,
        bytes: await (await fetch(`${BASE}inject/${name}`)).arrayBuffer(),
      })),
    );

    // ectt→cm-super map lines (font fix — scripts/vendor-busytex.sh).
    const fragmentRes = await fetch(`${BASE}ectt-map-fragment.txt`);
    const mapAppend = fragmentRes.ok ? await fragmentRes.text() : "";

    onProgress?.(total, total, "Iniciando motor…");
    this.worker = new Worker(`${BASE}uecetexlive.worker.js`);
    this.worker.onmessage = (event) => {
      const data = event.data as WorkerReply & { kind?: string };
      if (data.kind === "print") return; // engine chatter
      const resolve = this.pending.get(data.id);
      if (resolve) {
        this.pending.delete(data.id);
        resolve(data);
      }
    };
    await this.call({ cmd: "init", base: BASE, dataPackages: DATA_PACKAGES, mapAppend });
  }

  private call(
    message: Record<string, unknown>,
    transfer: Transferable[] = [],
  ): Promise<WorkerReply> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error("worker not started"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, (reply) => {
        if (reply.ok) resolve(reply);
        else reject(new Error(reply.error ?? "worker error"));
      });
      worker.postMessage({ id, ...message }, transfer);
    });
  }

  async compile(
    input: CompileInput,
    onProgress?: CompileProgressFn,
  ): Promise<CompileResult> {
    const start = performance.now();
    await this.warmup();

    onProgress?.(0.02, "Enviando arquivos…");
    const files = [
      // Inject pack first — a project file with the same name wins.
      ...this.injectFiles.map(({ path, bytes }) => ({ path, bytes: bytes.slice(0) })),
      ...Object.entries(input.files).map(([path, bytes]) => ({
        path,
        bytes: bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
      })),
    ];
    await this.call({ cmd: "writeProject", files });

    const io = {
      exec: async (argv: string[]) => {
        const reply = await this.call({ cmd: "exec", argv });
        return {
          exitCode: reply.exitCode as number,
          stdout: reply.stdout as string,
          stderr: reply.stderr as string,
        };
      },
      readText: async (path: string) => {
        const reply = await this.call({ cmd: "readText", path });
        return reply.text as string | null;
      },
      readBytes: async (path: string) => {
        const reply = await this.call({ cmd: "readBytes", path });
        const buffer = reply.bytes as ArrayBuffer | null;
        return buffer ? new Uint8Array(buffer) : null;
      },
      writeFile: async (path: string, bytes: Uint8Array) => {
        const buffer = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;
        await this.call({ cmd: "writeFile", path, bytes: buffer }, [buffer]);
      },
    };

    const result =
      input.mode === "draft"
        ? await runDraftBuild(io, { entry: input.entry, onProgress })
        : await runFullBuild(io, {
            entry: input.entry,
            precompiledBbl: input.precompiledBbl,
            onProgress,
          });

    onProgress?.(1, "Concluído");
    return {
      ok: result.ok,
      pdf: result.pdf ?? undefined,
      log: result.log,
      diagnostics: result.diagnostics,
      passes: result.passes,
      durationMs: performance.now() - start,
    };
  }

  async dispose(): Promise<void> {
    this.worker?.terminate();
    this.worker = null;
    this.warmupPromise = null;
    this.pending.clear();
  }
}
