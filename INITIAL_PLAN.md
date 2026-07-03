# INITIAL_PLAN — UeceTexLive

> **Mission:** a 100 % static, frontend-only web app that loads the complete
> [uecetex2](https://github.com/thiagodnf/uecetex2) template — chapters,
> figures, bibliography, glossary, index, code listings, *everything* — and
> compiles it to a submission-quality PDF **entirely in the browser via
> WebAssembly**, edited through a Notion-grade WYSIWYG editor built on Tiptap.
>
> **The stated challenge:** *use ALL resources of uecetex2 in the browser.*
> Not the simplified single-file variant the Papyru prototype ships — the
> real thing: `documento.tex` + abnTeX2 + BibTeX (`abntex2-alf.bst`) +
> makeindex (glossary **and** index) + jpg/png/pdf figures + `.cpp` listings.
>

---

## 0. Execution contract (read first, agent)

You are building this repo (`~/s/notasocial/uecetexlive`) from zero. Rules:

1. **Phases are ordered and gated** (§15). Each gate has literal shell
   commands. A gate must pass before the next phase starts. If a gate fails
   3 consecutive fix attempts, stop, write `BLOCKED.md` with evidence, and
   continue with any phase that does not depend on the blocked one.
2. **TDD is non-negotiable for the two pure cores** — `latex-mapping` and
   `project` (§9). Write the failing test, then the code. UI components are
   built CDD-style: Storybook story with fixture data first, screen wiring
   second.
3. **Commit per completed task**, conventional commits (`feat:`, `test:`,
   `chore:`, `docs:`). Never commit with a red test suite. The first commit
   is this plan + `docs/`.
4. **The prototype is your parts donor.** It lives at
   `/home/morpheus/s/notasocial/papyru-your-academic-partner`. Appendix A
   lists exactly what to copy. Copy — do not reimplement what is proven.
5. **Read `docs/prototype-compile-pipeline.md` before touching anything
   WASM.** It is the reverse-engineered operations manual of the SwiftLaTeX
   engine and the TeX Live URL contract. Hard-won; ignore it and you will
   re-lose the weeks it encodes. **One known erratum:** its §10.2 claims the
   worker exposes a `bibtex` command — it does **not** (verified by grep:
   commands are only `compilelatex`, `compileformat`, `settexliveurl`,
   `writefile`, `mkdir`, `setmainfile`, `flushcache`, `grace`). Bibliography
   and index tooling comes from busytex (§3).
6. **Network fetches are enumerated** (Appendix A.3 gives exact URLs +
   expected sizes). Verify sizes after download; anything ±20 % off spec is
   a stop-and-inspect.
7. **YAGNI fence (§1.3) is binding.** If a feature is not in this plan, it
   does not get built in this run.
8. **When this plan conflicts with observed reality** (an API changed, a
   file 404s), reality wins: fix, note the deviation in `DEVIATIONS.md`,
   move on. Do not silently re-architect.

---

## 1. Product definition

### 1.1 What it is

- **Name:** UeceTexLive
- **Form:** static SPA. `bun run build` → `dist/` deployable to GitHub
  Pages / Cloudflare Pages / any dumb file server. No backend, no accounts,
  no server compile, no telemetry. All state client-side (IndexedDB).
- **Primary user:** a UECE student writing a monografia / dissertação / tese
  who should never install TeX Live nor fight `Undefined control sequence`.
- **Core loop:** open app → the full uecetex2 project is there → edit
  chapters in WYSIWYG (or raw LaTeX source view) → *Compilar* → PDF preview
  → download PDF / export project ZIP.

### 1.2 The two product bets

| Bet | Proof obligation |
| --- | --- |
| **B1 — full LaTeX toolchain in the browser** | upstream `documento.tex` compiles with resolved citations, glossary, index, figures, listings — zero servers |
| **B2 — Notion-grade WYSIWYG over LaTeX** | write a new chapter with headings, bold, lists, figure, citation, equation without ever seeing a backslash; serialized LaTeX is clean; round-trip is lossless |

Everything else in this plan exists to serve those two bets.

### 1.3 Non-goals (YAGNI fence — binding)

- No auth, cloud sync, collaboration, comments, AI features.
- No template gallery. uecetex2 only. (The `TemplateManifest` type keeps the
  door open; do not build the room.)
- No XeTeX/LuaTeX path (busytex ships them; we do not wire them — abnTeX2 is
  a pdfTeX class).
- No custom `.fmt` rebuilds.
- No i18n framework. UI copy is pt-BR, centralized in one
  `src/lib/strings.ts` module so extraction later is mechanical.
- No mobile-optimized editor (responsive layout yes, touch editing no).
- Biber: **research ladder only** (§3.6) — tiers above Tier 0/4 are not built
  in the one-shot run.

---

## 2. The challenge, itemized: uecetex2 complete resource inventory

Verified against the upstream tree (master, 2026-07). Every artifact below
must work in-browser. This table is the definition of done for Bet B1.

| # | Resource | Files | What it needs at compile time | Browser strategy |
| --- | --- | --- | --- | --- |
| R1 | Main document | `documento.tex` | pdfTeX, abnTeX2 class chain | busytex pdflatex (§3.3); file in memfs |
| R2 | Custom style | `lib/uecetex2.sty`, `lib/preambulo.tex` | resolved from project dir | memfs beside entry — kpathsea finds local files first |
| R3 | Pre-textual elements | `elementos-pre-textuais/*.tex` (9 files incl. `ficha-catalografica.pdf` inclusion) | `\input` resolution, pdfpages/graphicx for the PDF ficha | memfs; PDF inclusion via pdfTeX native `\includegraphics` |
| R4 | Chapters | `elementos-textuais/*.tex` (6 files) | `\input` | memfs; **these are the WYSIWYG-editable zone** (§4) |
| R5 | Appendices/annexes | `elementos-pos-textuais/{apendices,anexos}/*.tex` (5 files) | `\input` | memfs; WYSIWYG-editable |
| R6 | Bibliography | `elementos-pos-textuais/referencias.bib` + `lib/abntex2-alf.bst` + `\bibliographystyle{lib/abntex2-alf}` / `\bibliography{...}` | **classic BibTeX** (not biber!) multi-pass | busytex **bibtex8** with `--csfile` for pt-BR sorting (§3.6 Tier 0) |
| R7 | Glossary | `elementos-pos-textuais/glossario.tex`, `\imprimirglossario`; `.latexmkrc` rule: `makeindex -s doc.ist -t doc.glg -o doc.gls doc.glo` | **makeindex** with `.ist` style emitted by the glossaries machinery | busytex **makeindex** (§3.7) |
| R8 | Index | `\imprimirindice` → `documento.idx` | **makeindex** second invocation (`.idx → .ind`) | busytex makeindex (§3.7) |
| R9 | Figures | `figuras/*.jpg` (2), `*.png` (5+logos), `ficha-catalografica.pdf` | graphicx include of jpg/png/pdf | memfs binary files; pdfTeX reads them natively from memfs (no HTTP format-code round trip needed when local) |
| R10 | Code listing | `figuras/main.cpp` | `listings`/`\lstinputlisting` file read | memfs |
| R11 | Class chain | abnTeX2 (`abntex2.cls`, `abntex2cite.sty`, …), memoir, babel+`hyphen-portuguese`, and transitive deps | TeX Live packages | busytex `.data` bundles: abnTeX2 is inside **ubuntu-texlive-latex-extra** (verify against its `providespackage.txt` at vendor time) |
| R12 | Multi-pass build | `.latexmkrc` (pdflatex, bibtex, makeindex glossary hook) + `Makefile` | orchestration: pdflatex → bibtex → makeindex ×2 → pdflatex ×2 | our TS orchestrator (§3.5) reproducing latexmk's fixpoint loop |
| R13 | License/docs | `LICENSE`, `doc/*.pdf`, `README.md` | — | vendor `LICENSE` verbatim; link `doc/` PDFs from the About screen (do not bundle, they are 10+ MB of scanned norms) |

Explicitly *not* compile inputs: `Dockerfile`, `.github/`,
`figuras/ficha-catalografica.doc`.

---

## 3. Compile architecture

### 3.1 Toolchain requirements matrix

What each uecetex2 artifact demands vs. what each candidate engine provides:

| Requirement | SwiftLaTeX (prototype) | busytex wasm |
| --- | --- | --- |
| pdfTeX | ✅ (1.7 MB wasm, TL 2020 `.fmt`) | ✅ (TL 2023-era, part of 30.4 MB busybox-style binary) |
| bibtex | ❌ (no worker command — verified) | ✅ bibtex8 |
| makeindex (R7+R8) | ❌ | ✅ |
| kpsewhich | ❌ (HTTP kpathsea shim) | ✅ |
| xdvipdfmx / XeTeX / LuaHBTeX | ❌ | ✅ (unused by us) |
| TeX file delivery | on-demand HTTP per file (elegant, tiny first paint) | upfront Emscripten `.data` bundles |
| Payload before first compile | ~1.7 MB + on-demand (~10–20 MB for a real doc) | ~30 MB wasm + ~170 MB data (≈80–110 MB over the wire with compression) |
| Read files back out of memfs | ❌ (would need a worker patch) | ✅ (pipeline driver exposes outputs) |
| Maintenance | upstream dead; we self-host + 2 patches (documented) | active repo; **wasm artifacts last built 2024-02-16** |
| Institutional knowledge | `docs/prototype-compile-pipeline.md` | their `busytex_pipeline.js` example + our integration notes to be written |

### 3.2 Engine decision: dual engine, one interface

**Primary/“Full build”: busytex.** It is the only prebuilt path to
bibtex8 + makeindex in WASM — non-negotiable for the challenge (R6–R8).

**Secondary/“Draft”: SwiftLaTeX pdfTeX**, ported as-is from the prototype.
One fast pdflatex pass, on-demand file fetch, ~1 s warm compiles while
typing. Citations render as `[?]`, glossary/index sections empty — clearly
labeled *Rascunho* in the UI. It already works; porting is ~zero cost and
it rescues the first-run UX (no 100 MB download to see your first PDF).

Both implement the same interface. UI code never knows which ran:

```ts
// src/features/compiler/types.ts
export interface CompileInput {
  entry: string;                        // "documento.tex"
  files: Record<string, Uint8Array>;    // full project VFS, paths relative to root
  mode: "draft" | "full";
  /** Present when the user imported a precompiled .bbl (§3.6 Tier 4). */
  precompiledBbl?: Uint8Array;
}

export interface CompileDiagnostic {
  severity: "error" | "warning";
  file?: string;        // resolved source file
  line?: number;        // 1-based, in that file
  message: string;
  rawLogExcerpt: string;
}

export interface CompileResult {
  ok: boolean;
  pdf?: Uint8Array;
  log: string;
  diagnostics: CompileDiagnostic[];   // parsed from the log (§4.7)
  passes: string[];                   // e.g. ["pdflatex","bibtex8","makeindex:glo","makeindex:idx","pdflatex","pdflatex"]
  durationMs: number;
}

export interface PdfCompiler {
  readonly id: "swiftlatex-draft" | "busytex-full";
  /** Resolves when engine + data are loaded; reports download progress. */
  warmup(onProgress?: (loaded: number, total: number, label: string) => void): Promise<void>;
  compile(input: CompileInput, onProgress?: (p: number, label: string) => void): Promise<CompileResult>;
  dispose(): Promise<void>;
}
```

Engine modules are **client-only**: loaded via dynamic `import()` from event
handlers/effects, never from the module graph of the route files. (The app
is a SPA so there is no SSR to break, but keeping the discipline keeps the
option of prerendering the shell later.)

### 3.3 busytex integration spec

**Artifacts** (exact URLs in Appendix A.3), vendored under
`public/wasm/busytex/`:

| File | Size | Role |
| --- | --- | --- |
| `busytex.wasm` | 30.4 MB | all engines in one binary (busybox model) |
| `busytex.js` | 0.3 MB | Emscripten glue |
| `busytex_worker.js` | ~10 KB | reference worker — study it, then write ours in TS |
| `busytex_pipeline.js` | ~20 KB | reference pipeline driver — same |
| `texlive-basic.data` + `.js` | 104.6 + 2.1 MB | TL base tree as Emscripten FS bundle |
| `ubuntu-texlive-latex-recommended.data` + `.js` | 9.1 + 0.3 MB | memoir etc. |
| `ubuntu-texlive-latex-extra.data` + `.js` | 49.5 + 1.4 MB | **contains abnTeX2** |
| `ubuntu-texlive-fonts-recommended.data` + `.js` | 10.3 + 0.4 MB | font coverage |
| `texmf.cnf`, `updmap.cfg`, `dvipdfmx.cfg` | KBs | runtime config |

Total hosted: ~208 MB. Over-the-wire with precompression (§11): expect
80–110 MB, downloaded **once**, then service-worker-cached forever (§11.3).

**Integration design** — our own thin worker
(`src/features/compiler/busytex.worker.ts`):

1. Worker imports `busytex.js` glue + the `.data` loader `.js` files
   (Emscripten `Module.preRun` FS population).
2. Expose one message: `{cmd:"run", tool:"pdflatex"|"bibtex8"|"makeindex",
   argv:string[], files?:{path,bytes}[], readback:string[]}` →
   `{status, stdout, stderr, outputs:{path,bytes}[]}`. Each `run` is one
   `callMain(argv)` on a **fresh Module instance** (Emscripten mains are not
   re-entrant; the reference `busytex_pipeline.js` shows the reset pattern —
   follow it, this is the #1 integration trap).
3. Project files are written under `/work/`, TL trees live where the `.data`
   bundles mount them; set `TEXMFCNF`/`TEXMFVAR` per the vendored
   `texmf.cnf` (mirror the reference pipeline's env).
4. No SharedArrayBuffer, no COOP/COEP required (single-threaded mains inside
   one worker — the upstream demo runs from plain `python -m http.server`;
   verify once during integration and record in `DEVIATIONS.md` if wrong).
5. `warmup()` fetches wasm+data with a progress callback (the 100 MB moment
   must have a real progress bar, §6.3) and keeps the worker alive between
   compiles; memfs persistence between runs is an optimization —
   correctness first: re-write project files every compile.

### 3.4 SwiftLaTeX draft engine port

Copy from the prototype **verbatim** (paths in Appendix A.1):

- The three engine files **with both existing patches** (absolute worker
  URL; `fileid`/`pkid` static-host fallback). Details + rationale:
  `docs/prototype-compile-pipeline.md` §2.
- The TL 2020 on-demand slice (~83 MB) under
  `public/wasm/swiftlatex/texlive/` and `scripts/sync-texlive-cache.sh`.
- `WasmTectonicCompiler.ts` → rename class `SwiftLatexDraftCompiler`,
  implement the §3.2 interface (`warmup` = `loadEngine` +
  `setTexliveEndpoint`; `mode:"draft"` only; single pass).

Add abnTeX2's package set to the sync script (`abntex2`, `memoir`, `babel`,
`hyphen-portuguese`, `fancyhdr`, `titlesec`, `caption`, `booktabs`,
`microtype`, `lastpage`, `listings`, `imakeidx`/`makeidx`, `glossaries` if
TL2020 has it, iterate from 404s in the network log — the log names every
missing file). Draft mode is *expected* to render `[?]` citations; that is
the product contract, not a bug.

**Fallback clause:** if the TL 2020 `.fmt` cannot load abnTeX2 at all
(kernel-era mismatch, see prototype doc §7), draft mode falls back to
running busytex pdflatex single-pass. Keep the draft/full split in the UI
regardless — it is a product distinction, not an engine distinction.

### 3.5 The orchestrator (latexmk-in-TS)

`src/features/compiler/orchestrator.ts` — a pure-logic state machine
(unit-testable without WASM; worker calls injected):

```
full build fixpoint:
  1. pdflatex documento.tex          (pass 1: emits .aux, .glo, .idx, "Citation undefined" warnings)
  2. if \bibdata in documento.aux AND no precompiledBbl:
       bibtex8 --wolfgang --csfile cp850pt.csf documento     (emits .bbl)
     else if precompiledBbl: write documento.bbl
  3. if documento.glo exists and non-empty:
       makeindex -s documento.ist -t documento.glg -o documento.gls documento.glo
  4. if documento.idx exists and non-empty:
       makeindex documento.idx      (emits .ind)
  5. pdflatex (pass 2: consumes .bbl/.gls/.ind)
  6. pdflatex (pass 3) — repeat up to N=5 while the log says
     "Rerun to get cross-references right" or the .aux hash changed
  7. read back documento.pdf + documento.log
```

- `--csfile`: bibtex8 sorting for pt-BR accented names; vendor a suitable
  `.csf` from the bibtex8 distribution (inside texlive-basic bundle —
  locate via `kpsewhich`-in-worker at integration time; if none fits,
  `--wolfgang` alone is the accepted degradation, note it).
- Every pass appends to `CompileResult.passes` and streams a progress label
  (`"Compilando (2/6): bibliografia…"`).
- Unit tests drive the state machine with scripted fake worker responses:
  no-bib project skips step 2; empty `.glo` skips 3; loop terminates at N=5
  even if the log keeps demanding reruns (fixture: `rerun-forever.log`).

### 3.6 Bibliography: BibTeX now, biber as a graded ladder

**Ground truth:** uecetex2 uses *classic BibTeX* —
`\bibliographystyle{lib/abntex2-alf}` + `\bibliography{...}` (verified in
`documento.tex`). **No biber is required to meet the challenge.** The ladder
below exists because the user asked for biber to be *seriously considered*,
not hand-waved as impossible:

| Tier | What | Status in this plan |
| --- | --- | --- |
| **0** | **bibtex8 via busytex** — covers uecetex2's `abntex2-alf.bst` and `abntex2cite` exactly | **Ship in the one-shot run** (§3.5 step 2) |
| **1** | biblatex with `backend=bibtex8` — for users migrating to `biblatex-abnt`; biblatex officially supports the bibtex8 backend with reduced sorting/Unicode features | Document in README as supported-with-caveats; add one e2e fixture project to prove it compiles |
| **2** | **True biber in WASM.** Honest assessment: biber is Perl with XS-native deps — `Text::BibTeX` wraps the btparse C library, plus `XML::LibXML` (libxml2). The only Perl-in-browser artifact, WebPerl (Perl 5.28 via Emscripten), is dormant since ~2019 and supports XS only if you rebuild Perl with the XS modules statically linked into the Emscripten build. Nobody has published a biber-wasm (searched 2026-07: zero hits). Feasible in principle; estimated multi-week toolchain R&D with high failure risk | **Not in the one-shot run.** Standing R&D ticket `docs/research/biber-wasm.md` capturing this assessment, so the door has a map on it |
| **3** | **“biberlite”** — a TypeScript reimplementation of the subset biber performs for a fixed style: parse `.bcf` (XML build-control file), parse `.bib`, execute the sorting scheme, generate labels, emit `.bbl` in biblatex ≥3.x format, scoped to what `biblatex-abnt` needs | The *realistic* long-term biber path for a static app. Not in the one-shot run; specced in the same research doc |
| **4** | **`.bbl` import escape hatch** — user (or a GitHub Action on their repo) runs biber once elsewhere and drops `documento.bbl` into the project; orchestrator detects `precompiledBbl` and skips the bib pass | **Ship in the one-shot run** — it is ~20 lines in the orchestrator + one file-upload affordance, and it makes *any* biblatex/biber document compilable today |

Tiers 0+4 shipping together means: every uecetex2 user is fully served, and
even biber-dependent documents have a working (if manual) path — without
betting the release on Perl-to-WASM archaeology.

### 3.7 Glossary + index (makeindex ×2)

Reproduces uecetex2's `.latexmkrc` custom dependency exactly (§3.5 steps
3–4). Details that will bite otherwise:

- The `.ist` style file (`documento.ist`) is *generated by the document's
  glossary machinery during pass 1* — it comes out of memfs, not out of a
  TeX Live bundle. Read it back after pass 1 and hand it to makeindex.
- makeindex writes warnings to the `.glg`/`.ilg` transcripts — surface them
  in the log pane, do not swallow.
- Fixture for tests: a 3-entry glossary + 5-term index mini-document with
  known-good `.gls`/`.ind` golden outputs.

### 3.8 Images, listings, included PDFs

All project-local (R9, R10): they ride into memfs with the VFS and pdfTeX
reads them natively — **no TeX Live cache work, no format-code archaeology**
(that only applies to the draft engine's HTTP kpathsea, where images already
in memfs are found before any HTTP lookup; see prototype doc §"Compiling a
real project" D).

One real constraint: memfs binary fidelity. The VFS stores `Uint8Array`
end-to-end (IndexedDB `Blob`s in, bytes out); never round-trip binaries
through strings. Zod schema enforces it (§5.1).

---

## 4. The WYSIWYG editor (Bet B2)

### 4.1 Architecture: constrained bidirectional mapping

No off-the-shelf Tiptap extension edits LaTeX documents; the official
[Mathematics extension](https://tiptap.dev/docs/editor/extensions/nodes/mathematics)
covers only `$…$` via KaTeX. Overleaf's visual mode is CodeMirror
decorations, not reusable. **We build the extension suite.** The trap is
trying to WYSIWYG *arbitrary* LaTeX (a research project). We don't:

1. **Whitelist** the constructs the uecetex2 corpus actually uses; map each
   to a Tiptap node/mark (§4.2).
2. **Everything else becomes `rawLatex`** (inline or block): an opaque,
   editable, monospace-rendered chunk whose source text is preserved
   **byte-for-byte**. Parse what we know; carry what we don't. Losslessness
   by construction.
3. **Ground truth is always the LaTeX source.** The WYSIWYG is a projection:
   parse on open, serialize on save/compile/view-toggle. There is no
   separate rich-text persistence format.
4. **Scope: one content file at a time.** Editable zone = R4 + R5 + the
   prose pre-textuals (`resumo`, `abstract`, `dedicatoria`, `epigrafe`,
   `agradecimentos`). `documento.tex`, `lib/*` are **source-view-only**
   (locked behind an "avançado" toggle). This kills the hard cases —
   mid-document macro definitions, preamble surgery — without hurting the
   target user.

### 4.2 Node & mark inventory

| LaTeX construct | ProseMirror | Notes |
| --- | --- | --- |
| `\chapter{…}` | `heading level=1` | in appendix files, serializes back to `\chapter` unchanged |
| `\section` / `\subsection` / `\subsubsection` | `heading` 2/3/4 | |
| paragraph text | `paragraph` | blank-line separated; preserve `%`-comment lines adjacent to paragraphs as `latexComment` |
| `\textbf` | `bold` mark | |
| `\textit` / `\emph` | `italic` mark | remember which command via mark attr `cmd` so round-trip is exact |
| `\underline` | `underline` mark | |
| `\texttt` | `code` mark | |
| `itemize` / `enumerate` | `bulletList` / `orderedList` (+`listItem`) | nested lists supported |
| `\begin{citacao}` (abnTeX2 long quote) | `blockquote` node w/ attr `env="citacao"` | ABNT 4 cm quote — a first-class button in the UI |
| `\begin{figure}[…]` + `\centering` + `\includegraphics[…]{…}` + `\caption` + `\label` | `latexFigure` atom node — attrs: `src`, `options`, `caption`, `label`, `placement` | node view renders the actual image from the VFS via object URL |
| `\begin{table}` + `tabular` | `latexTable` atom node (v1: **read-only projection** + "editar como LaTeX" button opening the raw chunk) | WYSIWYG table *editing* is explicitly Phase-later; tables are where these editors die |
| `\cite{k1,k2}` / `\citeonline{…}` | `citation` inline atom — attrs `keys[]`, `cmd` | renders ABNT-style `(AUTOR, ano)` chip from the parsed `.bib` |
| `\ref{…}` / `\autoref` / `\pageref` | `crossref` inline atom | renders `→ label` chip; picker lists known `\label`s from the include graph |
| `$…$` and `\(...\)` | inline math node | KaTeX render; edit popover shows raw TeX |
| `equation` / `align` / `\[...\]` | block math node w/ attr `env` | |
| `\lstinputlisting[…]{…}` | `codeInclude` atom node | shows the referenced file's first lines, read from VFS |
| `lstlisting` env | `codeBlock` w/ attr `language` | |
| `% comment` (own line) | `latexComment` node | dimmed; hidden when "modo limpo" toggle is on |
| `\footnote{…}` | `footnote` inline node | popover editing |
| **anything else** | `rawLatex` (block or inline) | monospace chunk, dimmed border, still text-editable |

### 4.3 `latex-mapping` package (the TDD heart)

`src/features/latex-mapping/` — **pure functions, zero DOM, zero Tiptap
imports** (operates on ProseMirror-JSON plain objects):

```ts
parseLatex(source: string): { doc: PMDocJSON; }        // never throws: worst case = one big rawLatex
serializeDoc(doc: PMDocJSON): string;
```

- Parser: `@unified-latex/unified-latex-util-parse` → AST with source
  positions → transformer promotes whitelisted constructs, and for every
  AST region it does *not* recognize, slices the **original source text by
  position** into `rawLatex` (this — not AST re-printing — is what
  guarantees byte fidelity).
- Serializer: recursive walk emitting LaTeX; `rawLatex` nodes emit their
  stored text verbatim; whitespace policy: preserve original inter-block
  blank lines via a `blanksBefore` attr captured at parse time.
- **Invariant #1 (identity):** `serializeDoc(parseLatex(s).doc) === s` for
  every `.tex` file in the vendored uecetex2 — the regression suite,
  enforced in CI forever.
- **Invariant #2 (stability):** `parse(serialize(d))` is deep-equal to `d`
  for generated docs (property test with fast-check generators over the
  node inventory).
- Development order (strict TDD): write Invariant #1 suite first; make it
  green with the everything-is-rawLatex degenerate mapping (day 1); then
  promote constructs **one per red-green cycle** in this order: headings →
  text marks → paragraphs/comments → lists → citacao → citation → crossref
  → math → figure → codeBlock/codeInclude → footnote → table-projection.
  The suite stays green after every promotion.

### 4.4 Tiptap extension inventory

`bun add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/suggestion katex`
(latest stable; if a v3 peer conflict appears, pin the 2.26+ line — every
API used here exists in both).

| Extension | Source |
| --- | --- |
| `Document`, `Paragraph`, `Text`, `Heading`, `Bold`, `Italic`, `Underline`, `Code`, `BulletList`, `OrderedList`, `ListItem`, `Blockquote`, `History`, `Dropcursor`, `Gapcursor`, `Placeholder` | StarterKit (configured, not forked) |
| `RawLatexBlock`, `RawLatexInline` | ours — NodeView: monospace, subtle amber left border, tooltip "LaTeX bruto — o UeceTexLive preserva este trecho exatamente como está" |
| `LatexFigure`, `LatexTable`, `Citation`, `CrossRef`, `MathInline`, `MathBlock`, `CodeInclude`, `LatexComment`, `Footnote` | ours per §4.2 |
| `SlashMenu` | ours on `@tiptap/suggestion` |
| `PasteLatex` | ours: pasted text containing `\` commands runs through `parseLatex` and inserts the mapped fragment |

### 4.5 The Notion feel: concrete interactions

**Input rules** (fire as you type):

| Typed | Result |
| --- | --- |
| `# ` at line start | heading 1 (`\chapter`) |
| `## `, `### `, `#### ` | heading 2/3/4 |
| `**texto**` / `*texto*` | bold / italic |
| `- ` / `1. ` | bullet / ordered list |
| `> ` | citação longa (ABNT) |
| `$…$` | inline math (KaTeX renders on closing `$`) |
| `` ``` `` | code block |
| `--` | — (em dash, babel-safe serialization `--`) |

**Slash menu** (pt-BR, filtered as you type after `/`):

| Command | Inserts |
| --- | --- |
| `/capitulo`, `/secao`, `/subsecao` | headings |
| `/figura` | `latexFigure` + file-picker over VFS `figuras/` (with upload) |
| `/tabela` | `latexTable` scaffold (3×3) as raw block, projected |
| `/citacao` | bibliography picker (search over parsed `.bib` by author/title/year) → `citation` node |
| `/referencia` | `crossref` picker over known labels |
| `/equacao` | block math |
| `/codigo` | code block; `/codigo-arquivo` → `codeInclude` picker |
| `/nota` | footnote |
| `/latex` | raw LaTeX block for power users |

**Bubble menu** on text selection: B / I / U / code / cite / math / link-ref.
**Keyboard:** `Mod-b/i/u`, `Mod-Alt-1..4` headings, `Mod-Shift-c` cite
picker, `Mod-e` toggle WYSIWYG⇄source for current file, `Mod-Enter` compile.

### 4.6 Editor chrome

- **Left rail:** project tree grouped as uecetex2's semantic sections
  (Pré-textuais / Capítulos / Pós-textuais / Biblioteca (`lib`, locked) /
  Figuras). Chapter order mirrors the `\input` sequence parsed from
  `documento.tex` (§5.3). Per-file dirty dot; drag to reorder chapters
  rewrites the `\input` block in `documento.tex` (behind a confirm).
- **Center:** Tiptap surface (or CodeMirror-less `<textarea>`+highlight for
  source view — YAGNI: plain monospace textarea with the prototype's
  styling; CodeMirror only if source-editing pain is proven).
- **Right:** PDF pane (pdfjs-dist canvas, page thumbnails, zoom, page sync
  after compile) ⇄ Log pane (raw log + parsed `diagnostics` list on top).
- **Top bar:** project name, save state, engine toggle **Rascunho | Completa**
  (with size warning + progress on first Completa warmup), Compilar button
  (states: idle/warming/compiling/ok/error), Exportar (PDF / .zip), menu
  (Importar ZIP, Importar .bbl, Reset template, Sobre).

### 4.7 Compile-error ↔ editor mapping

pdfTeX logs errors as `./elementos-textuais/introducao.tex:42: Undefined
control sequence` (file-line-error mode: pass `-file-line-error`!). Parser
in `src/features/compiler/log-parser.ts` (pure, TDD, golden-log fixtures):

1. Extract `(file, line, message)` triples + "Rerun" flags + missing-file
   messages (`! LaTeX Error: File 'x.sty' not found`).
2. Map file → VFS path → open that file; map line → the WYSIWYG block whose
   source range (recorded during `parseLatex` as per-node `srcLine` attrs)
   covers it → scroll + shake + red gutter mark.
3. Draft-engine logs lack reliable positions sometimes → degrade to opening
   the log pane with the excerpt highlighted. Never crash on unparseable
   logs (fixture: truncated log, interleaved passes).

---

## 5. Project model & persistence

### 5.1 Zod schemas (`src/features/project/schema.ts`)

```ts
import { z } from "zod";

export const ProjectFileSchema = z.object({
  path: z.string().regex(/^[\w\-./]+$/).refine(p => !p.includes(".."), "no path traversal"),
  bytes: z.instanceof(Uint8Array),
  kind: z.enum(["tex", "bib", "bst", "sty", "cls", "image", "pdf", "code", "other"]),
  editable: z.boolean(),               // false for lib/, documento.tex gets "advanced"
});

export const ProjectSchema = z.object({
  schemaVersion: z.literal(1),          // bump + migrate on breaking change
  id: z.string(),                       // "uecetex2" for the seeded project
  name: z.string(),
  entry: z.string(),                    // "documento.tex"
  templateSource: z.string().url(),
  files: z.array(ProjectFileSchema),
  updatedAt: z.number(),
});

export const CompileSettingsSchema = z.object({
  mode: z.enum(["draft", "full"]).default("draft"),
  autoCompile: z.boolean().default(false),      // compile-on-idle, 2 s debounce
});
export type Project = z.infer<typeof ProjectSchema>;
```

Every IndexedDB read passes through `ProjectSchema.parse` — corrupt/legacy
state falls back to re-seeding the template (with an "estado anterior
exportado como zip" rescue download, never silent data loss).

### 5.2 IndexedDB layout (`idb` package, DB `uecetexlive@1`)

| Store | Key | Value |
| --- | --- | --- |
| `projects` | `project.id` | `Project` (files as Blobs internally for structured-clone efficiency) |
| `settings` | `"compile"` \| `"ui"` | zod-validated blobs |
| `compile-cache` | `"last-pdf"` | last successful PDF bytes + passes + timestamp (instant preview on reload) |

Autosave: 500 ms debounce after any editor/file mutation; save = serialize
current WYSIWYG file → update VFS → persist project. Save state indicator in
top bar (`Salvando… / Salvo`).

### 5.3 Include graph (`src/features/project/include-graph.ts`)

Pure + TDD. Parse `documento.tex` for `\input{…}`/`\include{…}` (via
unified-latex, not regex — comments must not count), yield the ordered file
list with section grouping (matching the `elementos-*` path prefixes) +
unresolved references (missing file → red entry in rail, one-click create).
Also harvest all `\label{…}` across the graph for the crossref picker, and
`\bibliography{…}` target for the citation picker.

### 5.4 ZIP import/export (`fflate`)

- **Export:** VFS → zip (paths preserved) — byte-identical to what
  `latexmk` needs locally; this is the interop story with Overleaf/local TeX.
- **Import:** zip → VFS with validation: must contain entry `.tex` (pick
  `documento.tex`, else largest root `.tex`, else ask), path sanitation via
  `ProjectFileSchema`, 50 MB cap, binary detection by extension.
- Round-trip test: export → import → deep-equal VFS.

### 5.5 Template seeding

`scripts/vendor-uecetex2.sh` clones upstream at a **pinned commit**, prunes
non-compile inputs (R13 exclusions), writes
`public/templates/uecetex2/manifest.json` (`{path,size,sha256}[]` — zod
schema shared with the loader) + the files + `LICENSE` verbatim. First app
boot fetches the manifest, loads all files into a new `Project`, persists.

---

## 6. UI spec

### 6.1 Layout & routes

- `/` — the editor (the app *is* the editor).
- `/sobre` — credits, licenses (§13), links to uecetex2's `doc/` norm PDFs,
  "how it works" (all-in-browser privacy pitch: *seu texto nunca sai do seu
  computador*).
- Desktop-first three-pane (rail 240 px / editor flex / preview 45 %),
  panes collapsible; below 900 px the preview becomes a tab.
- Port the prototype's visual language (Tailwind tokens, spacing, the calm
  paper-tone palette from its `styles.css` + shadcn primitives listed in
  Appendix A.2). No design exploration in the one-shot run — reuse.

### 6.2 Component inventory = Storybook inventory

Every row is a story file with fixture data, built **before** screen wiring
(CDD):

| Component | Story states |
| --- | --- |
| `AppShell` | default, rail collapsed, preview collapsed |
| `ProjectRail` | full tree, dirty files, missing include, locked lib |
| `EditorSurface` | each node type (one story per §4.2 row), empty doc |
| `RawLatexBlock` | inline, block, long content |
| `SlashMenu` | open, filtered, empty result |
| `BubbleMenu` | text selected, citation selected |
| `CitationPicker` | results, empty search, malformed bib entry |
| `FigureNodeView` | image found, missing file, pdf figure |
| `CompileButton` | idle, warming(progress), compiling(pass label), ok, error |
| `EngineToggle` | draft, full-not-downloaded (size warning), full-ready |
| `PdfPane` | rendered doc, empty state, stale-while-compiling overlay |
| `LogPane` | clean log, diagnostics list, draft-mode `[?]` notice |
| `ImportDialog` | zip ok, zip invalid, bbl import |
| `WarmupProgress` | busytex download with per-asset progress |

### 6.3 Critical microcopy (pt-BR, in `src/lib/strings.ts`)

- Engine toggle warning: *"A compilação completa baixa ~100 MB na primeira
  vez (uma única vez — fica salvo no navegador) e resolve bibliografia,
  glossário e índice. O rascunho é instantâneo, mas mostra [?] nas
  citações."*
- Draft-mode log banner: *"Modo rascunho: citações, glossário e índice não
  são resolvidos. Use a compilação Completa para o PDF final."*
- rawLatex tooltip (§4.4). Data-loss rescue copy (§5.1).

---

## 7. Repo layout (target, complete)

```
uecetexlive/
  INITIAL_PLAN.md                     # this file
  DEVIATIONS.md                     # written during the one-shot run
  README.md                         # user + contributor docs (Phase 7)
  LICENSE                           # ours (MIT) — third-party notices in /sobre + THIRD_PARTY.md
  THIRD_PARTY.md                    # §13 table
  package.json  bunfig.toml  tsconfig.json  vite.config.ts
  biome.json  lefthook.yml  playwright.config.ts
  .github/workflows/ci.yml  deploy.yml
  docs/
    prototype-compile-pipeline.md   # vendored knowledge.md (erratum noted §0.5)
    busytex-integration.md          # written during Phase 2 — our own knowledge.md for busytex
    research/biber-wasm.md          # §3.6 tiers 2–3 assessment
  scripts/
    vendor-uecetex2.sh              # §5.5
    vendor-busytex.sh               # Appendix A.3 downloads + size checks
    sync-texlive-cache.sh           # ported, for the draft engine slice
  public/
    templates/uecetex2/             # manifest.json + pinned upstream snapshot + LICENSE
    wasm/
      busytex/                      # §3.3 artifacts
      swiftlatex/                   # engine (2 patches) + texlive/ slice
  src/
    main.tsx  router.tsx  styles.css
    routes/  (index.tsx, sobre.tsx)
    lib/ (strings.ts, utils.ts, motion.ts)
    components/ui/                  # ported shadcn primitives (only the ones used)
    features/
      compiler/
        types.ts  orchestrator.ts  log-parser.ts
        busytex/ (BusytexFullCompiler.ts, busytex.worker.ts, module-reset.ts)
        swiftlatex/ (SwiftLatexDraftCompiler.ts)
        index.ts                    # lazy factory per engine id
      latex-mapping/
        parse.ts  serialize.ts  whitespace.ts  constructs/ (one module per §4.2 promotion)
        __tests__/ (identity.test.ts, stability.property.test.ts, per-construct tests)
        fixtures/ → symlink-free copies of the vendored uecetex2 .tex files
      editor/
        EditorSurface.tsx  extensions/ (one file per §4.4 row)
        node-views/  slash-menu/  bubble-menu/
      project/
        schema.ts  include-graph.ts  zip.ts  seed.ts  vfs.ts
      persistence/ (db.ts)
      preview/ (PdfPane.tsx, LogPane.tsx, DiagnosticsList.tsx)
      shell/ (AppShell.tsx, ProjectRail.tsx, TopBar.tsx, EngineToggle.tsx, WarmupProgress.tsx)
  e2e/ (compile-full.spec.ts, wysiwyg-roundtrip.spec.ts, import-export.spec.ts, draft-mode.spec.ts)
  .storybook/
```

## 8. Dependencies (exact)

**Runtime:** `react`, `react-dom` (19.x), `@tanstack/react-router`,
`@tiptap/react` + `@tiptap/pm` + `@tiptap/starter-kit` +
`@tiptap/suggestion`, `katex`,
`@unified-latex/unified-latex-util-parse` (+ `-types`),
`@retorquere/bibtex-parser` (citation picker; battle-tested in Zotero
better-bibtex), `zod` (4.x), `idb`, `fflate`, `pdfjs-dist`, `clsx`,
`tailwind-merge`, needed `@radix-ui/*` only (dialog, dropdown-menu, tooltip,
scroll-area, tabs, separator, popover), `lucide-react`, `motion`.

**Dev:** `typescript` (strict), `vite` (7.x) + `@vitejs/plugin-react` +
`@tailwindcss/vite` + `tailwindcss` (4.x), `vitest` + `@vitest/coverage-v8` +
`@testing-library/react` + `happy-dom`, `fast-check`, `storybook` (latest) +
`@storybook/react-vite`, `playwright`, `biome`, `lefthook`,
`vite-plugin-pwa` (service worker, §11.3).

Not included on purpose: i18next (fence §1.3), CodeMirror (YAGNI until
proven), react-hook-form (no forms of substance), TanStack Query (no
server).

## 9. Method: how YAGNI/TDD/CDD bind the run

- **TDD zones (test-first, no exceptions):** `latex-mapping`,
  `project` (schema/include-graph/zip/vfs), `compiler/orchestrator`,
  `compiler/log-parser`. These are all pure modules by design — that is
  *why* they were designed pure.
- **CDD zone:** everything under `features/{editor,shell,preview}` — story
  first, screen second. Stories run in CI (`storybook build` must succeed;
  smoke-test via test-runner is stretch, not gate).
- **Integration/e2e zone:** WASM engines are NOT unit-tested. One Playwright
  suite exercises real compiles headless (Chromium) against `vite preview`.
- **Coverage gate:** 90 % lines on the TDD zones; no global coverage gate
  (chasing shell coverage is theater).
- **YAGNI:** the fence in §1.3 + a standing rule — no abstraction until the
  second consumer exists. The only pre-approved abstractions: `PdfCompiler`
  (two consumers: §3.2) and `TemplateManifest` (consumer #2 arrives with
  "import ZIP as new project", already in scope).

## 10. Testing strategy (enumerated)

**Unit (Vitest):**
- `identity.test.ts` — Invariant #1 over every vendored uecetex2 `.tex` (all
  ~25 files, byte-equal).
- `stability.property.test.ts` — Invariant #2, fast-check doc generator.
- Per-construct parse/serialize tables (headings, marks, lists, citacao,
  citation incl. multi-key + `\citeonline`, crossref, math incl. `$` inside
  text edge cases, figure incl. options string preservation, comments,
  footnote, lstinputlisting).
- `orchestrator.test.ts` — §3.5 scenarios (skip-bib, skip-glossary,
  precompiledBbl, rerun-loop cap, pass labels).
- `log-parser.test.ts` — golden logs: clean, undefined-control-sequence,
  missing-file, rerun, truncated, draft-engine format.
- `include-graph.test.ts` — ordered inputs, comment-masked `\input`, missing
  file, label harvest.
- `zip.test.ts`, `schema.test.ts`, `vfs.test.ts` — §5 behaviors incl.
  corrupt-state rescue.

**Component (Storybook + Testing Library):** interaction tests for
SlashMenu filtering, CitationPicker search, input rules (type `# ` → h1),
Mod-e toggle preserving selection file.

**E2E (Playwright, against built app):**
1. `draft-mode.spec.ts` — boot, template visible, draft compile < 15 s cold,
   PDF pane non-empty, `[?]` notice shown.
2. `compile-full.spec.ts` — **the challenge gate**: warmup busytex (cached
   artifacts in CI), full pipeline, assert log contains bibtex8 + makeindex
   passes, assert PDF page count ≥ 60 (upstream compiles to a full
   dissertation skeleton) and text layer contains a known bibliography
   string (e.g. an author from `referencias.bib`) and a glossary term.
3. `wysiwyg-roundtrip.spec.ts` — open `introducao.tex` in WYSIWYG, type a
   heading + bold + list via input rules, insert citation via slash menu,
   toggle to source, assert clean LaTeX, compile full, assert new section
   title appears in PDF text layer.
4. `import-export.spec.ts` — export zip, wipe IndexedDB, import zip,
   deep-equal VFS, compile ok.

**Reference-PDF check (manual once, scripted after):** compile upstream
uecetex2 with real latexmk in Docker (`scripts/reference-build.sh`, uses
upstream's own Dockerfile) → store page count + extracted text hash in
`e2e/fixtures/reference.json`; the e2e asserts ±2 pages of it.

## 11. Static hosting & delivery

1. **Immutable caching:** everything under `/wasm/` and `/templates/` is
   content-stable → `Cache-Control: public, max-age=31536000, immutable`
   (`_headers` file for CF Pages; GH Pages fallback relies on SW).
2. **Precompression:** CF Pages brotli-compresses `.data`/`.wasm` on the
   edge automatically; verify `content-encoding: br` on `busytex.wasm` in
   the deploy gate. If the host won't compress `.data` (some treat it as
   opaque binary), ship `.data.br` + fetch-and-decompress in the worker
   (`DecompressionStream` is universal now) — decide by measurement, note in
   `DEVIATIONS.md`.
3. **Service worker (`vite-plugin-pwa`):** precache app shell; runtime
   cache-first for `/wasm/**` and `/templates/**`. After one full-build
   warmup the app works **fully offline** — this is the static-app payoff
   and a headline feature (*funciona no avião*).
4. **No COOP/COEP** expected (§3.3.4); do not add headers speculatively —
   they break embedding and pdf.js worker loading.
5. **Budgets:** app-shell JS < 350 KB gz (Tiptap+KaTeX+pdf.js are the bulk —
   code-split: KaTeX with the editor route chunk, pdf.js lazy on first
   preview); TTI < 2 s mid-laptop; draft compile warm < 3 s; full build
   (warm engine, uecetex2) < 60 s; keystroke→paint < 16 ms at p95 in a
   10-page chapter.

## 12. Performance & memory notes for the agent

- busytex Module instances: create-per-run, but **reuse the fetched
  wasm/data ArrayBuffers** (they are the 100 MB; instantiation is cheap,
  refetching is not). Keep them referenced in the worker, not the page.
- The full uecetex2 VFS is ~15 MB (figures + norm PDFs pruned). Writing it
  per compile is fine; do not diff-optimize preemptively.
- pdf.js: render current page ± 1 at zoom, thumbnails at 96 px lazily;
  destroy documents on new compile (their worker leaks otherwise).
- Tiptap: one editor instance, `setContent` on file switch (destroying the
  instance loses plugin state and costs ~100 ms per switch).

## 13. Licensing & attribution (`THIRD_PARTY.md`)

| Component | License | Obligation |
| --- | --- | --- |
| uecetex2 template | upstream `LICENSE` (vendor verbatim, verify at vendor time) | keep file, credit in /sobre |
| abnTeX2 (inside TL bundles) | LPPL 1.3 | no action beyond attribution |
| busytex code/glue | MIT | notice |
| busytex binary artifacts | aggregate of TeX Live component licenses (GPL/LPPL/…) | serve unmodified, link source repo — note in THIRD_PARTY |
| SwiftLaTeX engine files | **AGPL-3.0** — we serve patched artifacts | publish the two patches (they live in-repo, diff-documented in docs/prototype-compile-pipeline.md §2) + prominent source link. If distribution posture ever becomes a concern, the draft engine is the cuttable piece |
| Tiptap core, unified-latex, KaTeX, pdf.js, fflate, zod, idb | MIT/Apache-2 | notices |

## 14. Risk register

| # | Risk | Trigger to act | Contingency |
| --- | --- | --- | --- |
| K1 | abnTeX2 not actually complete inside `ubuntu-texlive-latex-extra.data` | Phase 2 probe compile missing `.cls/.sty` | busytex supports extra `.data` packs; worst case: inject missing packages into memfs from our own TL fetch (the draft-engine sync script already knows how to harvest TL packages) |
| K2 | busytex wasm build (2024-02) has a blocking defect for our flow | Phase 2 probe | pin to an older of the 5 wasm releases; escalate to building busytex from source only if all 5 fail (documented emsdk build in their CI) — that is a BLOCKED.md moment, not a silent detour |
| K3 | Module re-instantiation leaks memory → tab death after N compiles | e2e: 10 sequential full builds under `--expose-gc` heap watch | recycle the whole worker every M compiles (worker restart is < 2 s with buffers cached) |
| K4 | Round-trip identity fails on some upstream file (exotic construct) | Invariant #1 red | that construct stays `rawLatex` — the invariant defines the whitelist, never the reverse |
| K5 | TL2020 draft engine can't load abnTeX2 | Phase 4 probe | §3.4 fallback: draft = busytex single-pass |
| K6 | 100 MB first-download abandonment | analytics-free, so: usability note only | draft mode IS the mitigation; copy in §6.3 sells the trade |
| K7 | pt-BR sorting wrong in bibtex8 | golden-output check vs reference build | try TL's `csf` variants; accepted degradation documented |
| K8 | uecetex2 upstream changes | pinned commit in vendor script | bump deliberately, rerun reference build |

## 15. Phases & gates (the one-shot execution line)

**Phase 0 — Repo bootstrap.** Scaffold per §7/§8: bun + vite + TS strict +
biome + lefthook + vitest + storybook + playwright + tailwind + router;
empty AppShell renders; CI workflow runs check+test+build.
**Gate G0:** `bun install && bun run check && bun run build` green
(`check` = `biome check && tsc --noEmit && vitest run`); `bunx playwright
test e2e/smoke` loads the built app.

**Phase 1 — Vendor everything.** Run `scripts/vendor-uecetex2.sh` (pinned
commit) and `scripts/vendor-busytex.sh` (Appendix A.3); copy prototype
assets (Appendix A.1); seed project into IndexedDB on boot; rail shows the
real tree; source view edits + autosave work.
**Gate G1:** boot → rail lists all §2 file groups; edit + reload persists;
vendor scripts are idempotent (run twice, no diff).

**Phase 2 — busytex full pipeline (Bet B1 core).** Worker + module-reset +
orchestrator + log-parser (TDD zones first); wire CompileButton +
WarmupProgress + PdfPane + LogPane (their stories first).
**Gate G2:** e2e `compile-full.spec.ts` passes — upstream document with
citations + glossary + index resolved, matched against
`e2e/fixtures/reference.json`. **This gate is the challenge.** Write
`docs/busytex-integration.md` (our knowledge.md for busytex) before leaving
the phase.

**Phase 3 — latex-mapping (Bet B2 core).** Strict TDD per §4.3 promotion
order. No UI in this phase.
**Gate G3:** Invariant #1 green over every vendored `.tex`; Invariant #2
property suite green; per-construct tables green; coverage ≥ 90 % on the
package.

**Phase 4 — WYSIWYG surface.** Extensions + node views + slash/bubble menus
+ input rules + view toggle + error mapping (stories first, per §6.2);
citation/crossref pickers on include-graph + bib parse. Draft engine port
lands here too (§3.4 — it needs only CompileButton wiring).
**Gate G4:** e2e `wysiwyg-roundtrip.spec.ts` + `draft-mode.spec.ts` pass;
Storybook builds with every §6.2 story present.

**Phase 5 — Project I/O.** ZIP import/export, `.bbl` import (Tier 4),
chapter reorder, missing-include creation.
**Gate G5:** e2e `import-export.spec.ts`; orchestrator honors
`precompiledBbl` (unit + one e2e assert).

**Phase 6 — Delivery hardening.** Service worker, immutable headers,
compression verification, code-splitting to budget, offline test, /sobre +
THIRD_PARTY.
**Gate G6:** Lighthouse perf ≥ 90 / a11y ≥ 95 on `/`; airplane test
(devtools offline after one warmup → full compile still works); bundle
budget met (`vite build` report archived).

**Phase 7 — Docs & release.** README (user quickstart + contributor guide +
architecture map pointing at this plan), DEVIATIONS.md finalized, tag
`v0.1.0`.
**Gate G7:** a fresh `git clone && bun install && bun run dev` reproduces
the app; `bun run check` green; all prior gates re-run green.

---

## Appendix A — Parts donor & network fetch manifest

### A.1 Copy from the prototype (`/home/morpheus/s/notasocial/papyru-your-academic-partner`)

| From (prototype) | To (here) | Note |
| --- | --- | --- |
| `public/wasm/swiftlatex/PdfTeXEngine.js`, `swiftlatexpdftex.js`, `swiftlatexpdftex.wasm` | `public/wasm/swiftlatex/` | **contains the 2 mandatory patches** — copy, never re-download |
| `public/wasm/swiftlatex/texlive/` (~83 MB) | same | draft-engine TL slice |
| `scripts/sync-texlive-cache.sh` | `scripts/` | extend PACKAGES for abnTeX2 (§3.4) |
| `src/features/compiler/{types.ts,WasmTectonicCompiler.ts}` | `src/features/compiler/swiftlatex/` | adapt to §3.2 interface |
| `src/features/persistence/idb.ts` | `src/features/persistence/db.ts` | extend to §5.2 layout |
| `src/components/ui/*` (only: button, dialog, dropdown-menu, tooltip, scroll-area, tabs, separator, popover, sonner) | `src/components/ui/` | drop the other ~40 |
| `src/styles.css` design tokens + `src/lib/{utils.ts,motion.ts}` | same | visual language reuse (§6.1) |
| `knowledge.md` | `docs/prototype-compile-pipeline.md` | already copied at plan time |

### A.2 uecetex2 vendor (network)

`https://github.com/thiagodnf/uecetex2` — clone, pin the current master
commit hash into `scripts/vendor-uecetex2.sh`, prune per §2/R13.

### A.3 busytex vendor (network)

Base: `https://github.com/busytex/busytex/releases/download/build_wasm_4499aa69fd3cf77ad86a47287d9a5193cf5ad993_7936974349_1/`

| Asset | Expected size |
| --- | --- |
| `busytex.wasm` | 30.4 MB |
| `busytex.js` | 0.3 MB |
| `busytex_worker.js`, `busytex_pipeline.js` | ~KBs (reference reading) |
| `texlive-basic.js` / `texlive-basic.data` | 2.1 / 104.6 MB |
| `ubuntu-texlive-latex-base.js` / `.data` | 0.3 / 5.7 MB |
| `ubuntu-texlive-latex-recommended.js` / `.data` | 0.3 / 9.1 MB |
| `ubuntu-texlive-latex-extra.js` / `.data` | 1.4 / 49.5 MB |
| `ubuntu-texlive-fonts-recommended.js` / `.data` | 0.4 / 10.3 MB |
| `texmf.cnf`, `updmap.cfg`, `dvipdfmx.cfg` | KBs |
| `ubuntu-texlive-latex-extra.js.providespackage.txt` | 0.1 MB — **grep it for `abntex2` in the vendor script; fail loud if absent (risk K1)** |

`vendor-busytex.sh` verifies each size ±20 % and records sha256s into
`public/wasm/busytex/manifest.json`.

### A.4 Reference material

- Prototype pipeline manual: `docs/prototype-compile-pipeline.md` (this repo).
- busytex: <https://github.com/busytex/busytex> (MIT code; wasm release
  2024-02-16).
- uecetex2: <https://github.com/thiagodnf/uecetex2> (abnTeX2 +
  `abntex2-alf.bst` + makeindex glossary hook in `.latexmkrc`).
- Tiptap Mathematics ext: <https://tiptap.dev/docs/editor/extensions/nodes/mathematics>.
- unified-latex: <https://github.com/siefkenj/unified-latex>.
- biber (for the research doc): <https://github.com/plk/biber> — Perl,
  `Text::BibTeX`/btparse dependency chain; WebPerl:
  <https://webperl.zero-g.net> (dormant).
