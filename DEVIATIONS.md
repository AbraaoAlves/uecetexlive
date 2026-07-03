# DEVIATIONS — observed reality vs INITIAL_PLAN

Per §0.8: when the plan conflicts with reality, reality wins, noted here.

## D1 — Toolchain versions newer than plan (§8)

Installed latest stable at build time (2026-07-02): Vite **8.1** (plan: 7.x),
TypeScript **6.0**, Storybook **10.4**, Vitest **4**, Biome **2.5**, Tiptap
**3.27** (plan anticipated the 2.26 fallback; v3 installed cleanly, APIs used
exist in both). No API conflicts so far. TS 6 deprecates `baseUrl` —
`paths` is used relative to the tsconfig instead.

## D2 — Risk K1 realized: abnTeX2 is NOT in any busytex bundle (§3.3, A.3)

The plan instructed grepping `ubuntu-texlive-latex-extra.js.providespackage.txt`
for `abntex2`, failing loud if absent. It is absent — verified against the
`.good.txt` content listings of **all five** bundles. Ubuntu ships abnTeX2 in
`texlive-publishers`, which busytex does not build. `tracklang.sty` (hard dep
of `glossaries.sty`) is missing too.

**Contingency applied (as §14/K1 prescribes):** `scripts/vendor-busytex.sh`
fetches `abntex2` + `tracklang` from CTAN's tlnet archive and flattens their
runtime files into `public/wasm/busytex/inject/` (+ `manifest.json`). The
busytex compiler writes these into the compile working directory in memfs,
where kpathsea resolves them before any TL tree.

## D3 — Added `ubuntu-texlive-science` bundle (~9.6 MB, not in A.3)

`lib/preambulo.tex` uses `\usepackage{algorithm2e}` and
`\usepackage{algorithmic}`; `algorithmic.sty` exists only in the science
bundle. Added to the vendor list and warmup set.

## D4 — Biome cannot parse Tailwind 4 CSS syntax

`source(none)`, `@theme inline`, `@custom-variant` are parse errors for
Biome 2.5's CSS parser. CSS is excluded from Biome; Tailwind owns the file.

## D5 — busytex asset sizes vs A.3

Exact sizes were taken from the GitHub release API (A.3's MB figures were
approximations): e.g. `busytex_worker.js` is 1.2 KB, not ~10 KB. All within
the ±20% rule except none — the exact-size table is embedded in
`scripts/vendor-busytex.sh`.

## D6 — `.fmt` recovery folded into sync-texlive-cache.sh

The prototype recovered `swiftlatexpdftex.fmt` from Wayback manually
(prototype doc §6). For fresh-clone reproducibility (Gate G7) the sync script
now performs that recovery when the file is absent.

## D7 — Third SwiftLaTeX engine patch: SPA-fallback guard

The two prototype patches (worker URL, fileid fallback) assumed a static
host that 404s missing files. Any SPA-fallback host (vite preview, CF Pages
with fallback) returns the app's HTML shell with HTTP 200 for missing TL
paths — the engine then ingests HTML as TeX ("Missing \begin{document}",
`l.1 <`). Patched `swiftlatexpdftex.js` (both fileid/pkid branches, marker
`uecetexlive:spa-fallback-guard`) to treat `Content-Type: text/html`
responses as not-found.
