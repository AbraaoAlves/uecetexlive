# busytex integration — our knowledge.md

Everything learned wiring busytex's WASM toolchain (pdflatex + bibtex8 +
makeindex) into UeceTexLive. Read this before touching
`public/wasm/busytex/uecetexlive.worker.js` or
`src/features/compiler/busytex/`.

## 1. Artifact anatomy (release build_wasm_4499aa69…_1, 2024-02-16)

| Artifact | Role |
| --- | --- |
| `busytex.wasm` (30 MB) | ALL engines in one busybox-style binary: pdftex, xetex, luatex/luahbtex, bibtex8, makeindex, kpsewhich, xdvipdfmx. `argv[0]` selects the applet. |
| `busytex.js` | Emscripten glue. Exposes global `busytex(Module) → Promise<initializedModule>`. |
| `*.data` + loader `.js` ×6 | LZ4-compressed Emscripten FS bundles: `texlive-basic` (TL2023 base, mounts at `/texlive`), `ubuntu-texlive-latex-{base,recommended,extra}`, `-fonts-recommended`, `-science` (mount at `/texmf`). |
| `busytex_pipeline.js` | Reference driver. **We load and reuse its `BusytexPipeline` class** for module init + package mounting (proven code); pass sequencing is ours. |

## 2. The Module shim trap (why the worker is a *classic* worker)

The `.data` loader scripts were generated with:

```js
var Module = typeof BusytexPipeline !== 'undefined' ? BusytexPipeline : {};
```

They use the **`BusytexPipeline` class object itself** as the Emscripten
Module during load: static fields `preRun`, `calledRun`, `data_packages`,
`locateFile` catch the loaders' registrations. At real-Module creation,
`pre_run_packages` does `Object.setPrototypeOf(BusytexPipeline, Module)` so
the queued preRun callbacks resolve `FS_createPath`/`LZ4` through the
prototype chain. Consequences:

- Loaders must run via `importScripts` in the same global as
  `BusytexPipeline` → **classic worker**, not a module worker (Vite bundles
  module workers; importScripts is illegal there). Hence the worker lives in
  `public/wasm/busytex/uecetexlive.worker.js`, un-bundled.
- Never load two pipelines in one worker; the statics are global.

## 3. Re-entrancy: the memory-snapshot reset

Emscripten mains are not re-entrant, but busytex is compiled so that a heap
restore suffices (upstream `compile()` does exactly this):

```js
// after init:
memHeader = HEAPU8.slice(0, pipeline.mem_header_size /* 2^26 */);
// after every callMain:
HEAPU8.fill(0); HEAPU8.set(memHeader);
```

Init verifies memory beyond 64 MB is zero. MEMFS file state lives in JS
objects, not the wasm heap — it survives the reset (that's what makes
multi-pass builds work). **Do not** create a fresh Module per run; reuse +
reset (instantiation is cheap but the reset is cheaper and matches upstream).

## 4. Filesystem + env contract

- Project dir: `/home/web_user/project_dir` — unmounted & re-mounted MEMFS
  on every `writeProject` (correctness first; §12 says don't diff-optimize).
- Env (set in preRun by BusytexPipeline): `TEXMFDIST=/texlive/texmf-dist:/texmf/texmf-dist`,
  `TEXMFVAR=/texlive/texmf-dist/texmf-var`, `TEXMFCNF=/texlive/texmf-dist/web2c`.
- pdflatex needs the fmt passed explicitly:
  `--fmt /texlive/texmf-dist/texmf-var/web2c/pdftex/pdflatex.fmt`.
- Our pass argv (orchestrator.ts): `pdflatex --no-shell-escape
  --interaction=nonstopmode --output-format=pdf --fmt <fmt>
  -file-line-error <tex>`; `bibtex8 --8bit <job>.aux`;
  `makeindex -s <job>.ist -t <job>.glg -o <job>.gls <job>.glo`;
  `makeindex <job>.idx`.
- No SharedArrayBuffer, no COOP/COEP needed — single-threaded mains.

## 5. What was missing from the bundles (all injected at compile time)

Everything below is fetched from CTAN by `scripts/vendor-busytex.sh` into
`public/wasm/busytex/inject/` and written into the project cwd on every
compile (kpathsea's `$TEXMFDOTDIR` = cwd wins every search path):

| Gap | Symptom | Fix |
| --- | --- | --- |
| **abnTeX2** (risk K1 — Ubuntu ships it in `texlive-publishers`, busytex doesn't build that) | `abntex2.cls not found` | inject `abntex2` (cls/sty/bst/bib) |
| **tracklang** (glossaries hard dep) + its generic `tracklang.tex` | `\input{tracklang}` fatal in tracklang.sty:46 | inject `tracklang` incl. `.tex` files |
| **babel-portuges** | `Package babel Error: Unknown option 'brazil'` | inject (`brazil.ldf` + friends) |
| **microtype 3.1a bug** (bundled version) | `.toc` explodes: `Argument of \MakeUppercase has an extra }` + `\MT@gobble@to@nil` keys — 3.1a is incompatible with the memoir/abnTeX2 uppercased TOC on kernel 2022-11 | inject current CTAN microtype (sty/def/cfg shadow the tree's) |
| **cm-super absent** | pdfTeX fatal: `mktexpk … ectt1200` + `fork(): Function not implemented` (T1 typewriter has no Type1 outline) | inject `sftt*.pfb` + `cm-super-t1.enc`; **write a merged `pdftex.map`** (tree map + `ectt*` lines) into cwd — `TEXFONTMAPS` searches `$TEXMFDOTDIR` first, so the cwd map shadows the tree's |

Versions in the bundles (for future debugging): LaTeX2e 2022-11-01 pl1,
memoir 3.7.19, microtype 3.1a (buggy), babel 3.86, abnTeX2 —(absent).

## 6. Worker protocol (uecetexlive.worker.js)

Request/response with an `id`; unsolicited `{kind:"print"}` messages carry
engine chatter.

| cmd | payload | reply |
| --- | --- | --- |
| `init` | `base`, `dataPackages[]`, `mapAppend` | `{versions}` (applet → version string) |
| `writeProject` | `files: [{path, bytes}]` | `{}` (re-mounts MEMFS; auto-writes merged `pdftex.map`) |
| `exec` | `argv[]` | `{exitCode, stdout, stderr}` (heap reset after) |
| `readText` / `readBytes` | `path` | `{text|null}` / `{bytes|null}` (transferred) |
| `writeFile` | `path`, `bytes` | `{}` (used for precompiledBbl) |

## 7. Download/warmup

`BusytexCompiler.warmup()` prefetches wasm + 6×(.js+.data) with byte
progress (4-way parallel), then spawns the worker whose importScripts/fetch
hit the HTTP cache. ~216 MB raw; service-worker cached after first run
(Phase 6). Keep fetched buffers in the browser cache, not in page memory
(§12).

## 8. Known accepted degradations

- bibtex8 runs with `--8bit` only — no pt-BR `.csf` exists in the bundles
  (risk K7's accepted fallback). Sorting of accented names follows Latin-1
  byte order; matches upstream busytex behavior.
- xetex/luatex/xdvipdfmx ride along in the wasm but are unwired (§1.3).
