# SwiftLaTeX engine + vendored TeX Live slice

The browser compiler (`src/features/compiler/WasmTectonicCompiler.ts`) needs
three engine files at this path:

```
/wasm/swiftlatex/PdfTeXEngine.js
/wasm/swiftlatex/swiftlatexpdftex.js
/wasm/swiftlatex/swiftlatexpdftex.wasm
```

Source: https://www.swiftlatex.com/ (mirror of the SwiftLaTeX/SwiftLaTeX
release artifacts).

## Two local patches to the upstream engine

Both are marked with `papyru:static-fallback` / `Papyru patch:` comments so
they survive re-downloads (re-apply by hand if you replace the upstream files).

1. **`PdfTeXEngine.js` line ~63** — `ENGINE_PATH` changed from
   `'swiftlatexpdftex.js'` to `'/wasm/swiftlatex/swiftlatexpdftex.js'`.

   `new Worker(relativeURL)` resolves against the *document URL*, not the
   wrapper script URL — so on route `/` the worker would request
   `/swiftlatexpdftex.js`, get the SPA HTML shell back, fail to parse, and
   `loadEngine()` would hang forever (silent — no error event). Absolute path
   fixes it.

2. **`swiftlatexpdftex.js`** — the two `xhr.getResponseHeader("fileid")` /
   `getResponseHeader("pkid")` reads fall back to `reqname` when the header
   is absent. The upstream SwiftLaTeX CDN sent custom `fileid` headers so the
   worker could content-address its in-memory cache; static hosts (Vite,
   Cloudflare assets) don't set custom headers, so without the fallback every
   file would be written to `/tex/null` and overwrite the previous one.

## The vendored TeX Live cache (`./texlive/`)

SwiftLaTeX's upstream package CDN (`https://texlive2.swiftlatex.com/`) is
currently broken server-side — TLS handshake succeeds but the origin never
responds. So we serve the slice ourselves.

`WasmTectonicCompiler.ts` points the engine at the local mirror via
`engine.setTexliveEndpoint("/wasm/swiftlatex/texlive/")`. The worker then
requests `<endpoint>pdftex/<formatInt>/<filename>`.

### Layout

```
texlive/pdftex/3/   TFM font metrics (both "cmr12" and "cmr12.tfm" — worker omits the ext)
texlive/pdftex/10/  .fmt — pre-built engine format dump
texlive/pdftex/26/  .sty .cls .def .cfg .clo .fd .ldf
texlive/pdftex/32/  .enc (font encodings)
texlive/pdftex/33/  .vf  (virtual fonts)
texlive/pdftex/40/  .map (font maps)
```

The format integers are SwiftLaTeX-specific (don't match upstream kpathsea
exactly) and were observed empirically.

### Recovering the `.fmt` file

`swiftlatexpdftex.fmt` is a SwiftLaTeX-specific pdftex format dump (~10 MB,
"XT2W" magic). It cannot be regenerated from CTAN and only existed on the
dead CDN. The Wayback Machine has a 2022-06-14 snapshot:

```bash
mkdir -p public/wasm/swiftlatex/texlive/pdftex/10
curl -sk -L -o public/wasm/swiftlatex/texlive/pdftex/10/swiftlatexpdftex.fmt \
  "https://web.archive.org/web/20220614101233id_/https://texlive2.swiftlatex.com/pdftex/10/swiftlatexpdftex.fmt"
```

### Refreshing the package cache

Use the repo-rooted script:

```bash
./scripts/sync-texlive-cache.sh
```

It downloads tlnet per-package tarballs (`https://mirror.ctan.org/systems/texlive/tlnet/archive/<pkg>.tar.xz`),
extracts `.sty/.cls/.def/.cfg/.clo/.fd/.tfm/.vf/.enc/.map` into the flat
per-format-code dirs above, and creates extensionless duplicates for font
formats. Idempotent — tarballs are cached under `$TMPDIR/papyru-tlnet-cache/`.

To add a new TeX Live package (e.g. when a `\usepackage{X}` errors with
"file not found"):

1. Add the TL package name to the `PACKAGES=(...)` array in the script.
   The TL package name is usually `X` itself — check
   https://ctan.org/pkg/X or `https://mirror.ctan.org/systems/texlive/tlnet/archive/X.tar.xz`.
2. Re-run `./scripts/sync-texlive-cache.sh`.
3. Restart `vite dev` so it picks up the new `public/` files (Vite caches
   the directory listing at startup for some subtrees).

### Hot-path warning

After `./scripts/sync-texlive-cache.sh` adds new files, the dev server has
to restart to pick them up — Vite's `public/` resolution can serve files
under directories that existed at startup but 404s files in
directories created later.
