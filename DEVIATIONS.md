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

## D8 — Draft-engine TL2020 slice: many packages + base-35 map surgery

The draft engine's `.fmt` is TL2020-era; getting abnTeX2 to load took iterating
the sync package list from the 404 log (`textcase`, `xkeyval`+its generic
`.tex`, `translator`, `enumitem`, `glossaries-portuges`, `babel-english/spanish`,
`rsfs`, `dvips` for `8r.enc`, …), extracting `.tex`/`.sto` (not just `.sty`),
pulling `eso-pic` from the TL**2019** archive (the 2020 one adopted 2020-10 hook
management the fmt's kernel lacks), and **prepending base-35 URW font map
entries** to the synthesized `pdftex.map` (pdfTeX keeps the first entry per
name; psnfss's non-embedding `psyro` etc. lines otherwise win and abort output).
Risk K5 (fmt can't load abnTeX2) did **not** trigger — full uecetex2 renders in
draft in ~3 s.

## D9 — Build/PWA (Phase 6)

- Vite 8/rolldown: chunk splitting via `build.rolldownOptions.output.advancedChunks`
  (not the Vite-7 `manualChunks`). App-shell entry ~183 KB gz; Tiptap+KaTeX are
  a lazy chunk (WYSIWYG surface is `React.lazy`), pdf.js lazy on first preview.
- `vite-plugin-pwa`: the ~216 MB WASM/TeX payload is **not** precached (that is
  the app shell only); it is runtime CacheFirst so the first Completa warmup
  fills the cache and the app then works offline.

## D10 — Editor initial content + WYSIWYG e2e list creation

- Tiptap v3: `setContent()` issued before the editor's internal `onCreate`
  is silently discarded. EditorSurface passes the parsed doc as the initial
  `content` option and reloads only on file switch (keyed by `path`).
- `TrailingNode` is required so the caret can escape a document that ends in
  a `rawLatexBlock` (a code block — Enter inside it just adds a newline).
  `serializeDoc` drops that trailing empty paragraph.
- The bullet-list wrapping input rule fires reliably for a real user but is
  flaky under Playwright's synthetic keystrokes; the roundtrip e2e creates
  the list via the new `/lista` slash command instead. Input-rule lists are
  still covered by the `latex-mapping` unit suite.

## D11 — SwiftLaTeX removal attempted, then reverted: draft latency was impractical (2026-07-04)

A same-day attempt (commit `559de78`) removed the AGPL-3.0 SwiftLaTeX draft
engine and unified "Rascunho"/"Completa" under a single busytex pipeline,
running the draft as one `pdflatex` pass (no bibtex8/makeindex/rerun). The
trade-off accepted at commit time was ~75–85 s per draft compile (vs
SwiftLaTeX's ~3 s, D8) in exchange for license cleanliness (MIT-only) and a
single WASM pipeline; a GitHub Pages deploy improvement (gzip sidecars +
idle warmup, ~218.8→146.5 MB on the wire) was bundled into the same commit.
Hands-on use after the commit showed 75–85 s per draft compile is
impractical for an editor whose whole point is a fast feedback loop —
reverted in full rather than kept as an "accepted" trade-off. SwiftLaTeX
(AGPL-3.0) is back for "Rascunho"; busytex stays the sole engine for
"Completa". The gzip-sidecar/idle-warmup deploy work was reverted together
with it (the two were entangled in one commit — `useIdleWarmup`/`src/sw.ts`
warmed the unified `BusytexCompiler`) and can be redone standalone if still
wanted for the busytex Completa payload.

The AGPL license question is unresolved and open for a future attempt.
Candidates if revisited: trim the busytex draft's mounted TL package set,
a persistent `--fmt` warm dump, or sourcing a non-AGPL fast draft engine.
Full detail of what was tried lives in `git show 559de78` and this revert
commit.

## D12 — GitHub Pages deploy: gzip sidecars + idle warmup, re-added standalone (2026-07-05)

The deploy-side half of the D11 attempt was re-added on its own, scoped only
to the busytex engine (SwiftLaTeX draft doesn't need it — its own assets are
a couple MB, fetched on demand). Two measures so the ~220 MB busytex payload
(218 MB on disk) hurts less on the target host:

- **gzip sidecars.** GitHub Pages offers no header control and no on-the-fly
  compression for `application/octet-stream`/`wasm` — the payload would cross
  the wire raw. `scripts/precompress-wasm.sh` (run by deploy.yml after the
  build, scoped to `dist/wasm/busytex`) publishes `*.data.gz` + `busytex.wasm.gz`
  next to the originals (kept as a no-SW fallback), and the service worker —
  a custom `src/sw.ts` (`strategies: "injectManifest"`; precache and runtime
  routes match the old generateSW config) — fetches the sidecar, decompresses
  it via `DecompressionStream("gzip")` and caches the *decompressed* bytes
  under the original URL. Missing sidecar (dev/preview/CI serve the raw
  vendored files) falls back to the original URL; SPA-fallback HTML (the D7
  lesson) is detected via content-type, and hosts that transparently
  content-decode are handled by peeking the gzip magic bytes.
- **Idle warmup.** `useIdleWarmup` starts the one-time busytex warmup shortly
  after boot — after `navigator.serviceWorker.ready`, so the download flows
  through the sidecar route — with a discreet topbar indicator ("Preparando
  motor completo: NN%", `IdleWarmupIndicator`) that yields to the compile
  flow's own warmup UI. Guards: skipped under `navigator.webdriver` (an eager
  ~150 MB fetch per page would sink e2e machines) and
  `navigator.connection.saveData`; localStorage `uecetexlive:idle-warmup` =
  `force` / `off` overrides. `BusytexFullCompiler.warmup` fans progress out to
  a listener set (late subscribers get the last event), so clicking Compilar
  (Completa) mid-prefetch still shows byte progress instead of going quiet.
  SwiftLaTeX (Rascunho) has its own, separate warmup — unaffected.

Unlike the original D12 (bundled with D11), this one only ever warms
`busytex-full`; there is no unified compiler to warm "either mode" through.
`e2e/sw-gzip.spec.ts` validates the SW serves busytex `.data` byte-perfect in
both the sidecar and raw layouts, without booting the engine.

## D13 — Extração de pacotes: decisões de estilo/copy do `@uecetexlive/editor` (2026-07-05)

Execução do `package_extraction.md` (Fases 0–3). Duas decisões da Fase 2
registradas aqui porque a implementação difere em grau do texto do plano:

- **Estilo.** O plano pedia "não emite Tailwind utilitário opinativo".
  Reescrever ~1.7k linhas de componentes para CSS neutro sem verificação
  visual era troca ruim. Implementado o meio-termo: os componentes mantêm
  utilitários Tailwind escritos sobre o **vocabulário de tokens semânticos**
  (`surface`, `ink`, `accent`, `border`, `warning`, `danger`) — que no
  Tailwind v4 resolvem para CSS custom properties definidas pelo *consumidor*
  — mais ganchos estáveis (`data-testid`, classes `uecetex-*` nos nós do
  schema). A skin é de quem consome (Papyru define seus próprios tokens); o
  contrato está no README do pacote. Revisitar se o Papyru precisar de
  desacoplamento total do Tailwind.
- **Copy.** `EditorStringsProvider`/`useEditorStrings` cobre tudo que vinha
  de `@/lib/strings` (+ tooltips que estavam duplicados hardcoded em
  `nodes.ts`). Literais PT-BR que **já eram** inline nos componentes (títulos
  de picker, estados vazios, rótulos do bubble menu) permanecem inline —
  mesmo comportamento de antes; extração completa fica para quando um
  consumidor precisar de i18n de verdade.
- **Auditoria `include-graph`/`reorder`/`new-chapter` (Fase 2 item 5):**
  `new-chapter.ts` hardcoda `elementos-textuais/` (acoplado ao template) —
  **fica no app**. `include-graph.ts`/`reorder.ts` são genéricos, mas só têm
  consumidores no app — **ficam no app** até haver demanda externa; o editor
  foi desacoplado deles (`EditorResourceGraph` estrutural).

## Gate status (final)

| Gate | Status | Evidence |
| --- | --- | --- |
| G0 | ✅ | `bun run check` + `bun run build` green; `smoke.spec.ts` |
| G1 | ✅ | `seed-persist.spec.ts` (rail groups + reload persistence); vendor scripts idempotent |
| G2 | ✅ **the challenge** | `compile-full.spec.ts`: full in-browser build (bibtex8 + makeindex×2), 51 pp ±2 of Docker reference, bibliography + glossary in the PDF text layer |
| G3 | ✅ | Invariant #1 over all 22 vendored `.tex`; Invariant #2 property; 93.95% lines on the TDD zones |
| G4 | ✅ | `a-wysiwyg-roundtrip.spec.ts` + `draft-mode.spec.ts`; Storybook builds with the §6.2 inventory |
| G5 | ✅ | `import-export.spec.ts` (VFS deep-equal round-trip + `.bbl` Tier-4) |
| G6 | ✅ | PWA runtime cache-first for `/wasm` + `/templates`; app-shell ~183 KB gz (< 350); immutable `_headers` |
| G7 | ✅ | README quickstart reproduces from vendor scripts; `bun run check` green; all gates re-run green |
