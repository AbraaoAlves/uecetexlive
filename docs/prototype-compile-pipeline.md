# In-browser LaTeX compile via SwiftLaTeX WASM — what we learned

Everything reverse-engineered while turning the bundled SwiftLaTeX engine
from "silent 2-hour hang on first compile" into "1-second offline PDF of a
non-trivial ABNT template." Read this before extending the compile path or
templating story.

---

## TL;DR

The browser side is a 1.7 MB WASM pdftex compiled by emscripten, driven by a
JS wrapper that runs in the main thread and a Web Worker that runs pdftex.
The wrapper communicates with the worker via `postMessage`. The worker
fetches TeX Live files on demand from an HTTP endpoint. SwiftLaTeX's own
endpoint (`texlive2.swiftlatex.com`) is dead, so we self-host the slice we
need under `public/wasm/swiftlatex/texlive/` and point the worker at it via
`engine.setTexliveEndpoint("/wasm/swiftlatex/texlive/")`.

To compile real multi-file projects (e.g. `documento.tex` with chapters,
images, bibliography, a custom class), several things change beyond the
template — see [§ Compiling a real project](#compiling-a-real-project-uecetex2)
at the end.

---

## 1. The three engine files

The browser compiler [`src/features/compiler/WasmTectonicCompiler.ts`](src/features/compiler/WasmTectonicCompiler.ts)
expects three artifacts under `public/wasm/swiftlatex/`:

| File | Size | Role |
|---|---|---|
| `PdfTeXEngine.js` | ~12 KB | TS-compiled wrapper that loads in the page, exposes `PdfTeXEngine` class, spawns the worker |
| `swiftlatexpdftex.js` | ~83 KB | The Web Worker; emscripten glue + kpathsea-over-HTTP + Module setup |
| `swiftlatexpdftex.wasm` | ~1.7 MB | The pdftex binary itself, compiled to WebAssembly |

Source: `https://www.swiftlatex.com/` mirrors the official SwiftLaTeX/SwiftLaTeX
release artifacts. They are not on CTAN, jsdelivr, or any community fork —
this is the only live distribution point we found.

---

## 2. Two patches that must persist on these files

Both are flagged with `papyru:` / `Papyru patch:` comments so they survive
re-downloads. If you ever replace the upstream files, **re-apply both** or
the engine breaks.

### 2.1 Absolute Worker URL — `PdfTeXEngine.js:63`

```diff
- var ENGINE_PATH = 'swiftlatexpdftex.js';
+ var ENGINE_PATH = '/wasm/swiftlatex/swiftlatexpdftex.js';
```

Why: the wrapper calls `new Worker(ENGINE_PATH)` at line 89. `new Worker(relativeURL)`
resolves the URL **against the document's base URL**, not the wrapper script's
URL. On route `/` the browser fetches `/swiftlatexpdftex.js`, which the SPA's
dev server happily returns as the 200 HTML shell. The browser passes that HTML
to V8 as worker source, V8 silently fails to parse it as a script, the worker
never sends its `ready` `postMessage`, and the wrapper's `loadEngine()` waits
forever. **There is no error event.** The DevTools entry just stays "pending."

Symptom users see: "Compile" button spinner spins indefinitely. Devtools shows
the worker request "pending" for hours.

### 2.2 fileid/pkid header fallback — `swiftlatexpdftex.js`

```diff
- const fileid=xhr.getResponseHeader("fileid");
+ const fileid=xhr.getResponseHeader("fileid")||reqname;/*papyru:static-fallback*/
…
- const pkid=xhr.getResponseHeader("pkid");
+ const pkid=xhr.getResponseHeader("pkid")||reqname;/*papyru:static-fallback*/
```

Why: the worker's in-memory cache writes each downloaded file to
`/tex/<fileid>` in the WASM memfs. `fileid` is supposed to come from a custom
`fileid:` response header set by SwiftLaTeX's CDN (content-addressed storage).
Static hosts (Vite, Cloudflare assets) don't set custom headers, so without
the fallback **every file would be written to `/tex/null`**, overwriting the
previous one — the engine would race packages against itself and crash in
exotic ways.

Use of `reqname` as the cache key is safe because the worker rejects names
containing slashes at the top of the function: `if(reqname.includes("/")){return 0}`.

---

## 3. How the worker requests files (THE URL CONTRACT)

This is the single most important thing to understand. The worker has two
file-resolution paths into the host:

### 3.1 `kpse_find_file_impl` — generic file lookup

```js
const cacheKey = format + "/" + reqname;
const remote_url = self.texlive_endpoint + "pdftex/" + cacheKey;
```

So requests look like `<endpoint>pdftex/<formatInt>/<filename>` — flat path,
no subdirs. `<formatInt>` is the kpathsea format code (integer) and
`<filename>` is the literal name pdftex's kpathsea passed in.

### 3.2 `kpse_find_pk_impl` — PK font lookup

```js
const cacheKey = dpi + "/" + reqname;
const remote_url = self.texlive_endpoint + "pdftex/pk/" + cacheKey;
```

Special `pk/<dpi>/<name>` path for PK bitmap fonts (only triggered when Type1
fonts can't be found via the map).

### 3.3 Response contract

| HTTP status | Worker behavior |
|---|---|
| 200 | File saved to `/tex/<fileid>` in memfs and used. Required header: `fileid:` (we patched this to fall back to `reqname`). |
| 301 | Treated as "not found"; cached in `texlive404_cache[cacheKey]` so subsequent lookups don't retry. |
| Anything else (incl. 404) | Returned as "not found" but **NOT cached** → re-fetched on every compile. Slow but works. |

Most static hosts (Vite, Cloudflare) return 404 for missing files, so missing
packages cost extra round-trips per compile. Not blocking, but a perf cliff.

---

## 4. Format codes (kpathsea integers) — observed empirically

SwiftLaTeX's pdftex doesn't follow upstream kpathsea numbering exactly. The
table below comes from **watching the actual network log during a real
compile**, not from documentation. Mismatches here cost hours of debugging.

| Code | Type | Worker request pattern | Notes |
|---|---|---|---|
| 3 | TFM font metrics | `pdftex/3/cmr12` | Requested **without extension**. We serve at `pdftex/3/cmr12` AND `pdftex/3/cmr12.tfm` (extensionless duplicate). |
| 10 | `.fmt` | `pdftex/10/swiftlatexpdftex.fmt` | Pre-built engine format dump. ~10 MB. Only one file. |
| 11 | `.map` | `pdftex/11/pdftex.map` | Font map (canonical name `pdftex.map`). Synthesized by catting per-encoding maps. |
| 26 | LaTeX sources | `pdftex/26/article.cls`, `geometry.sty`, `l3backend-pdfmode.def` | Catches `.sty .cls .def .cfg .clo .fd .ldf`. |
| 32 | `.pfb` Type1 fonts | `pdftex/32/cmr12.pfb` | The actual font outlines embedded in the PDF. ~100s of files. |
| 33 | `.vf` virtual fonts | `pdftex/33/cmr12.vf` | Rarely needed if `.pfb` is present. We currently leave this empty. |
| 41 | `.pgc` | `pdftex/41/cmr8.pgc` | Pre-generated glyph container. Don't ship; pdfTeX falls through to PK. |
| 44 | `.enc` encoding | `pdftex/44/cm-super-ts1.enc` | Font encoding vectors. Required when fonts need post-processing (e.g. T1 re-encoding). |
| 26 (again) | Aux/log files | `pdftex/26/main.aux`, `main.out` | LaTeX always 404s these on first pass (no .aux yet); pdfTeX accepts the miss. |

Special non-integer path:
| Path | Type | Notes |
|---|---|---|
| `pdftex/pk/<dpi>/<name>` | PK bitmap font | Only requested when Type1 lookup fails. Means your `pdftex.map` is incomplete. |

---

## 5. Endpoint pointing — `setTexliveEndpoint`

The wrapper exposes `engine.setTexliveEndpoint(url)` (line ~237 of
`PdfTeXEngine.js`). Call it **after** `loadEngine()` returns:

```ts
await this.engine.loadEngine();
this.engine.setTexliveEndpoint("/wasm/swiftlatex/texlive/");  // trailing slash!
```

The trailing slash matters — the worker concatenates without inserting one.

Underneath, this sends `{cmd:'settexliveurl', url}` to the worker, which
overwrites `self.texlive_endpoint`. All subsequent `kpse_find_file_impl` calls
use the new base.

---

## 6. The TeX Live CDN situation

Upstream `https://texlive2.swiftlatex.com/` is **broken server-side** — TCP
connects in ~100 ms (Cloudflare front), TLS handshake completes, then the
origin pull never returns. Three consecutive 15 s timeouts. DNS resolves
fine. We confirmed this isn't network-side from our IP.

- **No active community mirror found** (jsdelivr/GitHub/raw.githubusercontent
  return 404; no fork hosts the texlive cache).
- **Wayback Machine has only the `.fmt` file** archived from that path
  (snapshot `20220614101233`, 10.3 MB, `XT2W` magic). Recovered via:

  ```bash
  curl -sk -L -o public/wasm/swiftlatex/texlive/pdftex/10/swiftlatexpdftex.fmt \
    "https://web.archive.org/web/20220614101233id_/https://texlive2.swiftlatex.com/pdftex/10/swiftlatexpdftex.fmt"
  ```

  The `id_` suffix asks Wayback for the raw payload (no toolbar injection).

- **All other files come from TeX Live historic mirrors**. We pin to
  TL 2020 because the `.fmt`'s baked `LaTeX2e <2020-02-02> patch level 2`
  predates the breaking changes in modern packages (e.g. `\IfDocumentMetadataTF`
  added 2022). Mixing eras = "Undefined control sequence" errors.

  Live mirrors at this writing:
  - `https://ftp.tu-chemnitz.de/pub/tug/historic/systems/texlive/2020/tlnet-final/archive/`
  - `https://ftp.math.purdue.edu/mirrors/ctan.org/historic/systems/texlive/2020/tlnet-final/archive/` (intermittent)

---

## 7. The `.fmt` version trap and the L3 backend stub

The recovered `.fmt` was built by SwiftLaTeX with a **custom L3 layer** that
calls a backend file named `l3backend-pdfmode.def`. This name **does not exist
in any TeX Live release** (2020 through 2024 all ship `l3backend-pdftex.def`).

Aliasing the file (`cp l3backend-pdftex.def l3backend-pdfmode.def`) makes the
file present but its **version metadata header doesn't match the .fmt's
preloaded L3 layer**, triggering:

```
! LaTeX Error: Mismatched LaTeX support files detected. Loading aborted!
```

Workaround: ship an **empty stub** at `pdftex/26/l3backend-pdfmode.def`:

```latex
\endinput
```

(See [`public/wasm/swiftlatex/texlive/pdftex/26/l3backend-pdfmode.def`](public/wasm/swiftlatex/texlive/pdftex/26/l3backend-pdfmode.def).)

This clears the version check, lets the compile proceed, and **probably
disables hyperref's PDF interactivity** (bookmarks, colored links). Plain
document rendering is unaffected.

**To fully fix this** you'd need to either:
- Rebuild the `.fmt` against a coherent LaTeX kernel (the wrapper has
  `compileFormat()` for this — untested, would require packaging the L3
  source files into memfs and running ini-mode pdftex).
- Reach SwiftLaTeX maintainers for the custom L3 source.

Same trap, different engine: busytex's bundled l3kernel also exposes
`pdfmode` as a `sys/backend` choice (real, current l3kernel — confirmed
against CTAN), but the alias-resolution to `l3backend-pdftex.def` /
`luatex.def` (`\__sys_load_backend_check:N`) is missing or incomplete in the
vendored snapshot, so the deferred `\begin{document}` load asks for
`l3backend-pdfmode.def` verbatim and no real TeX Live release ships that
file. `scripts/vendor-busytex.sh` writes the same empty-stub workaround into
the inject pack (`public/wasm/busytex/inject/l3backend-pdfmode.def`).

---

## 8. The TL package sync script

[`scripts/sync-texlive-cache.sh`](scripts/sync-texlive-cache.sh) is
idempotent. Edit the `PACKAGES=(...)` array to add what you need, then run:

```bash
./scripts/sync-texlive-cache.sh
```

Design points:
- **Per-package tarballs from TL 2020 tlnet historic archive**. Each
  tarball downloaded once (cached in `${TMPDIR}/papyru-tlnet-cache/`), then
  decompressed **whole** into a per-package staging dir, then walked.
- **Don't extract per-file with `tar -xJf`** — that re-decompresses the
  whole archive once per file (we hit this; cm-super took ~20 minutes;
  bulk extract takes 1 second).
- File→format-code mapping in `ext_to_fmt()`. Extend when adding new file
  types (e.g. `.pdf` for graphics needs its own code — see §10.4 below).
- For font formats (`tfm`, `vf`, `enc`) the script writes **two copies**:
  with and without extension, since pdftex requests fonts both ways.
- After all packages extract, the script **synthesizes `pdftex.map`** by
  concatenating all `.map` files in `pdftex/11/`. Real TeX Live does this
  via `updmap` at install time; we do it inline.

The `pdftex.map` synthesis is **stupidly simple** (`cat` all maps). This
means entries for fonts whose `.pfb` we don't ship still appear in the map.
PdfTeX warns about them (e.g. "invalid entry for `pplbo8r'" — Palatino) but
continues. Cosmetic; ignore unless you start using one of those families.

---

## 9. The Vite dev-server quirk

`@cloudflare/vite-plugin` (or Vite's `publicDir` handling under TanStack
Start) **caches the directory listing of `public/` at server start**. This
means:

| Change made while dev server is running | Result |
|---|---|
| Modify an existing file under `public/` | Served immediately (file content is re-read) |
| Add a new file inside a directory that existed at startup | Served immediately |
| Add a new file inside a **directory that didn't exist** at startup | **404** until restart |

So whenever the sync script creates a new top-level format-code dir (e.g.
the first time you add `.enc` files and `pdftex/44/` is newborn), the dev
server must be restarted. After that, populating it with more files works
without restart.

Cloudflare assets in production rebuild the manifest at deploy, so this
quirk is dev-only.

---

## 10. What we don't have yet (and what each costs)

### 10.1 PDF interactivity (hyperref)

Currently inert because of the L3 backend stub (§7). Need to rebuild the
`.fmt` against a modern LaTeX kernel.

### 10.2 BibTeX / biblatex citations

Citations show as `[?]` because we never ran bibtex. The SwiftLaTeX worker
exposes a `cmd: 'bibtex'` message (visible in the worker source) — wiring
it would mean:
1. Run pdftex pass 1 → produces `main.aux`.
2. Send `{cmd:'bibtex', mainfile:'main'}` to the worker → produces `main.bbl`.
3. Run pdftex pass 2 → resolves citations.
4. Run pdftex pass 3 (if needed for cross-refs).

The compiler currently calls `compileLaTeX()` once. Multi-pass needs a new
wrapper, plus shipping the `.bst` files (any bibstyle the doc uses) and the
bibliography `.bib` itself in memfs.

### 10.3 Biber (modern biblatex)

Biber is a separate Perl binary, not part of the SwiftLaTeX wasm bundle. **You
cannot run biber in the browser** without compiling it to wasm yourself.
Workarounds: stick to bibtex with `biblatex` (`backend=bibtex`), or run a
server-side biber step.

### 10.4 Images

Templates with figures (`.pdf`, `.png`, `.jpg`) need:
- The image files written into memfs alongside the `.tex` files.
- pdftex's `\includegraphics` calls `kpse_find_file_impl` with format codes
  we haven't observed yet. Likely codes (kpathsea standard):
  - **36** for `.png`
  - **37** for `.jpg/.jpeg`
  - **40** for `.pdf` (graphics include)
- Easiest path: when you wire image support, run a compile, watch the
  network log for the actual codes (the worker logs every `pdftex/<n>/<file>`
  request), then update `ext_to_fmt` in the sync script and the
  `CompileInput.files` writer to put images into memfs.

### 10.5 Real cm-super filtering

We ship all 553 cm-super `.pfb` files (~25 MB). The V0 template uses ~10. A
production cut would filter `pdftex.map` to only entries whose `.pfb` exists,
shrinking the cache and silencing the pdftex warnings.

### 10.6 Service worker offline cache

Once the dev cache stabilises, registering a service worker that pre-caches
the `/wasm/swiftlatex/texlive/` tree would let users compile offline after
first visit. Currently every request goes to the dev server.

---

## 11. The end-to-end compile flow today

```
User clicks "Compile"
  ↓
EditorShell.handleCompile()
  ↓
getCompiler() → dynamic import("./WasmTectonicCompiler") (client-only)
  ↓
new WasmTectonicCompiler()
  ↓
compile({files:{"main.tex":bytes}, entry:"main.tex"})
  ↓
loadEngineScript()  ← injects <script src="/wasm/swiftlatex/PdfTeXEngine.js">
  ↓
new window.PdfTeXEngine()
  ↓
engine.loadEngine()  ← spawns Worker("/wasm/swiftlatex/swiftlatexpdftex.js")
                        which instantiates the WASM, replays preload format
  ↓
engine.setTexliveEndpoint("/wasm/swiftlatex/texlive/")
  ↓
engine.writeMemFSFile("main.tex", bytes)
  ↓
engine.setEngineMainFile("main.tex")
  ↓
engine.compileLaTeX()
  ↓
Worker runs pdftex; on every file lookup it XHRs to our endpoint
  ↓
Result: {status, pdf:Uint8Array, log:string}
  ↓
EditorShell renders <iframe src={URL.createObjectURL(blob)}>
```

First compile takes ~1.2 s (most of it is fetching ~30 small `.sty` files
from localhost). Subsequent compiles in the same session are faster because
the worker's `texlive200_cache` keeps loaded files in memfs.

---

## Compiling a real project (uecetex2)

> **Question:** "Knowing the success compile just compile a small template
> content and I need to compile a real project like
> https://github.com/thiagodnf/uecetex2 that start in `documento.tex`, We
> need to change something in public content directory?"

**Short answer:** yes, but most changes are in the **app code and TL cache**,
not the engine files themselves. The three engine files
(`PdfTeXEngine.js`, `swiftlatexpdftex.js`, `swiftlatexpdftex.wasm`) stay as
they are.

Here's the actual checklist, ordered by likely friction:

### A. Multi-file project support (app code, not public/)

uecetex2's `documento.tex` does `\input{capitulos/01-introducao}`,
`\includegraphics{figuras/logo.pdf}`, etc. Right now [`EditorShell.tsx`](src/features/editor/EditorShell.tsx)
calls `compiler.compile({ files: { "main.tex": editor }, entry: "main.tex" })`
— a single file with a fixed name.

You need to:
1. Build a virtual filesystem in the app: `Record<path, Uint8Array>` for all
   project files (`documento.tex`, every `.tex` chapter, every image,
   `uece.cls`, `*.bib`).
2. Pass it as `CompileInput.files`. The compiler already loops:
   ```ts
   for (const [path, bytes] of Object.entries(input.files)) {
     this.engine.writeMemFSFile(path, bytes);
   }
   ```
3. Set `entry: "documento.tex"`.

Mid-term you'll want an IndexedDB-backed project tree (the `idb` dep is
already in `package.json`), a left-pane file browser, and import-zip support
so users can drop the uecetex2 repo as a ZIP.

### B. The custom `uece.cls` and its deps (one-time, ship as default project)

uecetex2 ships its own `uece.cls`. Two ways to handle it:

1. **As part of the user's project** (recommended). When a user uploads
   uecetex2, the .cls travels with the project files into memfs. No change
   to `public/wasm/swiftlatex/texlive/`. pdftex resolves files in
   `/work/` (the entry's directory) before falling back to kpse remote
   lookups, so a `uece.cls` next to `documento.tex` will be found.

2. **As a vendored class** in the TL cache. Place at
   `public/wasm/swiftlatex/texlive/pdftex/26/uece.cls`. Avoid this — it
   couples your shipped cache to a specific template.

### C. ABNT-related TL packages (yes, change in public/)

`uece.cls` typically builds on `abntex2.cls`. Add to `scripts/sync-texlive-cache.sh`'s
`PACKAGES=(...)` and re-run:

```bash
abntex2          # abntex2.cls + abntex2cite.sty + ABNT bib styles
biblatex         # if uece.cls uses biblatex (most modern ABNT templates do)
biblatex-abnt    # ABNT bibliography style for biblatex
csquotes         # \enquote{} — pulled by biblatex
logreq           # biblatex dep
ifthen           # likely already present via TL base
xkeyval          # likely already present
fancyhdr         # headers
titlesec         # section formatting (ABNT often customises sections)
caption          # figure/table captions
subcaption       # subfigures
booktabs         # nicer tables
multicol         # multi-column abstracts
chngcntr         # counter reset rules
microtype        # typographic refinement (most modern templates use it)
babel            # \usepackage[brazilian]{babel}
hyphen-portuguese  # Portuguese hyphenation patterns (for babel)
```

Run `./scripts/sync-texlive-cache.sh` after editing. Likely **restart Vite
once** because `abntex2` puts files in `pdftex/26/` which Vite already knows
about — should serve immediately. The first compile of `documento.tex`
will produce a new round of "file not found" errors; iterate through them.

### D. Images (yes, change in public/ and code)

uecetex2 has `figuras/` with logos and figures (likely `.pdf` and `.png`).

1. **Update `scripts/sync-texlive-cache.sh`'s `ext_to_fmt()`** with image
   format codes once you observe them (likely 36 for png, 40 for pdf — verify
   from the network log of the first failing compile).
2. **Add `.pdf`, `.png`, `.jpg` to the `find` regex** in the script so they
   get copied out of any TL packages that ship them (rare; usually project-local).
3. **Wire image upload in the editor** so user-supplied images go into
   `CompileInput.files` alongside the `.tex` files.

Project-local images stay in the project; you don't vendor them under
`public/`.

### E. Bibliography (yes, app code; possibly public/ for `.bst`)

If uecetex2 uses bibtex with a custom `.bst` (ABNT styles like `abntex2-alf.bst`):

1. **Add `abntex2` package to sync** — it includes the .bst files in
   `texmf-dist/bibtex/bst/abntex2/`. The current sync script doesn't extract
   `.bst` — add `bst` to `ext_to_fmt` (likely format code 7, kpathsea
   `kpse_bst_format`) and to the find regex.
2. **Wire the bibtex pass** in the compiler. Currently
   `WasmTectonicCompiler.compileLaTeX()` runs pdftex once. Real templates
   need:
   ```
   pdftex → bibtex → pdftex → pdftex
   ```
   Pseudo-code:
   ```ts
   await engine.compileLaTeX();                 // pdftex pass 1
   await engine.bibtex({ mainfile: "documento" });  // produces .bbl
   await engine.compileLaTeX();                 // pdftex pass 2
   await engine.compileLaTeX();                 // pdftex pass 3 (settled)
   ```
   The wrapper doesn't expose `bibtex()` today; you'd add a wrapper method
   that sends `{cmd:'bibtex', mainfile}` to the worker (the worker handles
   it — see the bibtex command branch in `swiftlatexpdftex.js`).

If uecetex2 uses **biblatex with biber**: there's no biber-wasm. Either
switch the template to bibtex backend, or run biber server-side.

### F. Babel + Portuguese hyphenation (mostly automatic, one tweak)

`\usepackage[brazilian]{babel}` needs:
- `babel` package (TL: `babel` + `babel-portuges`).
- The `.fmt` to have Portuguese hyphenation patterns preloaded — **our
  recovered `.fmt` only has the patterns SwiftLaTeX baked in**. If hyphenation
  comes out wrong on Portuguese text, you need a rebuilt `.fmt`. Workaround:
  load patterns at document time via `\babelhyphenation`, slower but
  doesn't require a custom `.fmt`.

### G. Sanity: try the smallest possible cut first

Before vendoring all of the above, run uecetex2's compile and see which
files actually 404 in the network log. Many ABNT templates conditionally
load modules — you may only need 40% of what the package list suggests.

---

## What to read next if you're picking this up cold

1. [`scripts/sync-texlive-cache.sh`](scripts/sync-texlive-cache.sh) — the
   sync tool. Skim the `PACKAGES`, `ext_to_fmt`, and extraction loop.
2. [`public/wasm/swiftlatex/README.md`](public/wasm/swiftlatex/README.md) —
   the operations doc (recovery, layout, restart caveat).
3. [`src/features/compiler/WasmTectonicCompiler.ts`](src/features/compiler/WasmTectonicCompiler.ts)
   — the wrapper around the wrapper. Where to wire bibtex/biber/multi-pass.
4. The first ~250 lines of `public/wasm/swiftlatex/PdfTeXEngine.js` — the
   `postMessage` protocol between page and worker. Look for
   `prototype.compileLaTeX`, `prototype.compileFormat`,
   `prototype.setTexliveEndpoint`.
5. The `kpse_find_file_impl` and `kpse_find_pk_impl` functions in
   `public/wasm/swiftlatex/swiftlatexpdftex.js` (grep for them; they're in
   the minified blob). Authoritative source for the URL contract.
