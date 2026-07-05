/**
 * latexmk-in-TS (§3.5): the full-build fixpoint loop, pure logic. All I/O is
 * injected so the state machine unit-tests without WASM.
 *
 *   1. pdflatex            (emits .aux/.glo/.idx)
 *   2. bibtex8 --8bit      (if \bibdata in .aux and no precompiledBbl)
 *   3. makeindex -s .ist   (if .glo non-empty — glossary, per .latexmkrc)
 *   4. makeindex .idx      (if .idx non-empty — index)
 *   5. pdflatex ×2..N=5    (while the log demands a rerun)
 */
import { parseLatexLog } from "./log-parser";
import type { CompileDiagnostic } from "./types";

export interface OrchestratorIO {
  exec(argv: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
  readText(path: string): Promise<string | null>;
  readBytes(path: string): Promise<Uint8Array | null>;
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
}

export interface OrchestratorOptions {
  entry: string;
  precompiledBbl?: Uint8Array;
  /** Absolute path of the pdflatex .fmt inside the engine FS. */
  fmtPath?: string;
  maxPdflatexPasses?: number;
  onProgress?: (fraction: number, label: string) => void;
}

export interface FullBuildResult {
  ok: boolean;
  pdf: Uint8Array | null;
  log: string;
  passes: string[];
  diagnostics: CompileDiagnostic[];
}

export const BUSYTEX_PDFLATEX_FMT =
  "/texlive/texmf-dist/texmf-var/web2c/pdftex/pdflatex.fmt";

const MAX_PDFLATEX_PASSES = 5;

export function pdflatexArgv(texPath: string, fmtPath: string): string[] {
  return [
    "pdflatex",
    "--no-shell-escape",
    "--interaction=nonstopmode",
    "--output-format=pdf",
    "--fmt",
    fmtPath,
    "-file-line-error",
    texPath,
  ];
}

export async function runFullBuild(
  io: OrchestratorIO,
  options: OrchestratorOptions,
): Promise<FullBuildResult> {
  const {
    entry,
    precompiledBbl,
    fmtPath = BUSYTEX_PDFLATEX_FMT,
    maxPdflatexPasses = MAX_PDFLATEX_PASSES,
    onProgress,
  } = options;

  const job = entry.replace(/\.tex$/, "");
  const passes: string[] = [];
  const fullLog: string[] = [];
  let lastParsed = parseLatexLog("");
  let lastExit = 0;

  const runPdflatex = async (label: string, fraction: number) => {
    onProgress?.(fraction, label);
    const { exitCode, stdout, stderr } = await io.exec(pdflatexArgv(entry, fmtPath));
    passes.push("pdflatex");
    lastExit = exitCode;
    const log = (await io.readText(`${job}.log`)) ?? stdout;
    fullLog.push(`$ pdflatex ${entry} (exit ${exitCode})\n${log}\n${stderr}`);
    lastParsed = parseLatexLog(log);
  };

  // Pass 1
  await runPdflatex("Compilando (1/6): primeira passagem…", 0.1);

  // Bibliography
  const aux = (await io.readText(`${job}.aux`)) ?? "";
  if (precompiledBbl) {
    onProgress?.(0.35, "Compilando (2/6): bibliografia importada (.bbl)…");
    await io.writeFile(`${job}.bbl`, precompiledBbl);
    fullLog.push(`$ # bibtex8 pulado: usando ${job}.bbl importado (Tier 4)`);
  } else if (aux.includes("\\bibdata")) {
    onProgress?.(0.35, "Compilando (2/6): bibliografia…");
    // uecetex2 writes \bibliographystyle{lib/abntex2-alf.bst} (extension
    // included); bibtex8 appends .bst unconditionally and fails on
    // "….bst.bst". Normalize the aux before the pass.
    const fixedAux = aux.replace(/\\bibstyle\{([^}]*)\.bst\}/g, "\\bibstyle{$1}");
    if (fixedAux !== aux) {
      await io.writeFile(`${job}.aux`, new TextEncoder().encode(fixedAux));
    }
    // --wolfgang: huge capacity — abntex2-alf.bst overflows default hashes
    // (§3.5); --8bit: treat all 8-bit chars as letters (upstream default).
    const { exitCode, stdout, stderr } = await io.exec([
      "bibtex8",
      "--wolfgang",
      "--8bit",
      `${job}.aux`,
    ]);
    passes.push("bibtex8");
    const blg = (await io.readText(`${job}.blg`)) ?? "";
    fullLog.push(
      `$ bibtex8 --wolfgang --8bit ${job}.aux (exit ${exitCode})\n${stdout}\n${blg}\n${stderr}`,
    );
  }

  // Glossary (uecetex2 .latexmkrc custom dependency, §3.7)
  const glo = await io.readText(`${job}.glo`);
  if (glo && glo.trim() !== "") {
    onProgress?.(0.45, "Compilando (3/6): glossário…");
    const { exitCode, stdout, stderr } = await io.exec([
      "makeindex",
      "-s",
      `${job}.ist`,
      "-t",
      `${job}.glg`,
      "-o",
      `${job}.gls`,
      `${job}.glo`,
    ]);
    passes.push("makeindex:glo");
    const glg = (await io.readText(`${job}.glg`)) ?? "";
    fullLog.push(
      `$ makeindex ${job}.glo (exit ${exitCode})\n${stdout}\n${glg}\n${stderr}`,
    );
  }

  // Index
  const idx = await io.readText(`${job}.idx`);
  if (idx && idx.trim() !== "") {
    onProgress?.(0.55, "Compilando (4/6): índice remissivo…");
    const { exitCode, stdout, stderr } = await io.exec(["makeindex", `${job}.idx`]);
    passes.push("makeindex:idx");
    const ilg = (await io.readText(`${job}.ilg`)) ?? "";
    fullLog.push(
      `$ makeindex ${job}.idx (exit ${exitCode})\n${stdout}\n${ilg}\n${stderr}`,
    );
  }

  // Pass 2 (consumes .bbl/.gls/.ind)
  await runPdflatex("Compilando (5/6): segunda passagem…", 0.7);

  // Fixpoint: rerun while demanded, hard cap.
  while (
    lastParsed.needsRerun &&
    passes.filter((p) => p === "pdflatex").length < maxPdflatexPasses
  ) {
    await runPdflatex("Compilando (6/6): referências cruzadas…", 0.85);
  }

  onProgress?.(0.95, "Lendo PDF…");
  const pdf = await io.readBytes(`${job}.pdf`);

  return {
    ok: lastExit === 0 && pdf !== null && pdf.length > 0,
    pdf,
    log: fullLog.join("\n\n"),
    passes,
    diagnostics: lastParsed.diagnostics,
  };
}
