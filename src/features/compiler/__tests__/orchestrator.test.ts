import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type OrchestratorIO, runFullBuild } from "../orchestrator";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf-8");

interface FakeOptions {
  auxContent?: string;
  gloContent?: string;
  idxContent?: string;
  logsByPass?: string[]; // documento.log content after each pdflatex pass
  pdfBytes?: Uint8Array | null;
  bibtexExit?: number;
}

function makeFakeIO(opts: FakeOptions = {}) {
  const {
    auxContent = "\\relax\n",
    gloContent = "",
    idxContent = "",
    logsByPass = [fixture("clean.log")],
    pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    bibtexExit = 0,
  } = opts;

  const execLog: string[][] = [];
  const written: Record<string, Uint8Array> = {};
  let pdflatexRuns = 0;

  const files = () =>
    new Map<string, string | null>([
      ["documento.aux", pdflatexRuns > 0 ? auxContent : null],
      ["documento.glo", pdflatexRuns > 0 ? gloContent : null],
      ["documento.idx", pdflatexRuns > 0 ? idxContent : null],
      ["documento.ist", pdflatexRuns > 0 ? "% ist" : null],
      [
        "documento.log",
        pdflatexRuns > 0
          ? (logsByPass[Math.min(pdflatexRuns, logsByPass.length) - 1] ?? "")
          : null,
      ],
    ]);

  const io: OrchestratorIO = {
    async exec(argv) {
      execLog.push(argv);
      if (argv[0] === "pdflatex") pdflatexRuns++;
      const exitCode = argv[0] === "bibtex8" ? bibtexExit : 0;
      return { exitCode, stdout: "", stderr: "" };
    },
    async readText(path) {
      return files().get(path) ?? null;
    },
    async readBytes(path) {
      if (path === "documento.pdf") return pdflatexRuns > 0 ? pdfBytes : null;
      return null;
    },
    async writeFile(path, bytes) {
      written[path] = bytes;
    },
  };
  return { io, execLog, written };
}

describe("runFullBuild (§3.5 fixpoint)", () => {
  it("full pipeline: bib + glossary + index + rerun passes", async () => {
    const { io, execLog } = makeFakeIO({
      auxContent: "\\bibdata{elementos-pos-textuais/referencias}\n\\citation{x}\n",
      gloContent: "\\glossaryentry{x}{1}",
      idxContent: "\\indexentry{y}{2}",
      logsByPass: [fixture("rerun.log"), fixture("rerun.log"), fixture("clean.log")],
    });
    const result = await runFullBuild(io, { entry: "documento.tex" });

    expect(result.passes).toEqual([
      "pdflatex",
      "bibtex8",
      "makeindex:glo",
      "makeindex:idx",
      "pdflatex",
      "pdflatex",
    ]);
    expect(result.ok).toBe(true);
    expect(result.pdf).toBeInstanceOf(Uint8Array);

    const bibtexCall = execLog.find((argv) => argv[0] === "bibtex8");
    expect(bibtexCall).toContain("--8bit");
    const gloCall = execLog.find(
      (argv) => argv[0] === "makeindex" && argv.includes("-s"),
    );
    expect(gloCall).toEqual([
      "makeindex",
      "-s",
      "documento.ist",
      "-t",
      "documento.glg",
      "-o",
      "documento.gls",
      "documento.glo",
    ]);
  });

  it("no-bib project skips bibtex8", async () => {
    const { io } = makeFakeIO({ auxContent: "\\relax\n" });
    const result = await runFullBuild(io, { entry: "documento.tex" });
    expect(result.passes).not.toContain("bibtex8");
  });

  it("empty .glo skips glossary makeindex; empty .idx skips index", async () => {
    const { io } = makeFakeIO({ gloContent: "", idxContent: "" });
    const result = await runFullBuild(io, { entry: "documento.tex" });
    expect(result.passes.filter((p) => p.startsWith("makeindex"))).toEqual([]);
  });

  it("precompiledBbl: writes .bbl, skips bibtex even with \\bibdata", async () => {
    const bbl = new Uint8Array([1, 2, 3]);
    const { io, execLog, written } = makeFakeIO({
      auxContent: "\\bibdata{referencias}\n",
    });
    const result = await runFullBuild(io, {
      entry: "documento.tex",
      precompiledBbl: bbl,
    });
    expect(result.passes).not.toContain("bibtex8");
    expect(written["documento.bbl"]).toBe(bbl);
    expect(execLog.some((argv) => argv[0] === "bibtex8")).toBe(false);
  });

  it("rerun loop terminates at 5 pdflatex passes even if log keeps demanding", async () => {
    const { io } = makeFakeIO({
      logsByPass: [fixture("rerun-forever.log")],
    });
    const result = await runFullBuild(io, { entry: "documento.tex" });
    expect(result.passes.filter((p) => p === "pdflatex")).toHaveLength(5);
  });

  it("streams pt-BR progress labels", async () => {
    const labels: string[] = [];
    const { io } = makeFakeIO({
      auxContent: "\\bibdata{r}\n",
      gloContent: "\\glossaryentry{x}{1}",
    });
    await runFullBuild(io, {
      entry: "documento.tex",
      onProgress: (_f, label) => labels.push(label),
    });
    expect(labels.some((l) => l.includes("bibliografia"))).toBe(true);
    expect(labels[0]).toMatch(/Compilando/);
  });

  it("failed final pass: ok=false, diagnostics carried", async () => {
    const { io } = makeFakeIO({
      logsByPass: [fixture("file-line-error.log")],
      pdfBytes: null,
    });
    const result = await runFullBuild(io, { entry: "documento.tex" });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
  });
});
