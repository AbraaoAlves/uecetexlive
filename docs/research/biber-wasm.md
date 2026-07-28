# Biber in the browser — standing R&D ticket

> Status: **researched, not built**. uecetex2 uses classic BibTeX
> (`abntex2-alf.bst` via `abntex2cite`), fully served by bibtex8-in-WASM
> (tier 0) plus the `.bbl` import escape hatch (tier 4). This document keeps
> a map on the door for true biblatex/biber support.

## Tier 2 — true biber compiled to WASM

**Honest assessment: multi-week toolchain R&D with high failure risk.**

Biber is a Perl application, not a C program:

- Its hard native deps are XS modules: `Text::BibTeX` (wraps the **btparse**
  C library), `XML::LibXML` (libxml2), `Unicode::Collate` (partially XS).
- The only Perl-in-browser artifact is **WebPerl** (<https://webperl.zero-g.net>,
  Perl 5.28 via Emscripten), dormant since ~2019. WebPerl supports XS modules
  only if you rebuild Perl with each XS module **statically linked into the
  Emscripten build** — meaning an emsdk cross-build of btparse + libxml2 +
  perl + biber's ~40-module dep tree.
- Nobody has published a biber-wasm (searched 2026-07: zero hits on GitHub,
  npm, CTAN).
- Packaged biber binaries (the `biber` you download from SourceForge) are
  PAR::Packer bundles of a full perl runtime — ~30 MB compressed per
  platform; a WASM equivalent would likely land at 40–80 MB *on top of* the
  busytex payload.

Verdict: feasible in principle; not worth the risk/effort while tiers 0+4
serve every real uecetex2 user. Revisit only if a maintained perl-wasm
toolchain appears.

## Tier 3 — "biberlite": a TypeScript reimplementation of the needed subset

The *realistic* long-term path for a static app. Scope it to what
`biblatex-abnt` actually needs, not biber-in-general:

1. **Parse `.bcf`** (biblatex control file, XML): datasource list, sorting
   scheme, label rules, per-entrytype/per-field options. The `.bcf` schema is
   stable and documented in the biblatex manual appendix.
2. **Parse `.bib`**: already have `@retorquere/bibtex-parser` in the app
   (battle-tested in Zotero better-bibtex; handles crossrefs, strings,
   `@preamble`).
3. **Execute the sorting scheme**: biblatex ≥3.x sorting templates
   (`\DeclareSortingTemplate`) — for `biblatex-abnt` this is NTY-ish with
   pt-BR collation. `Intl.Collator("pt-BR")` covers the collation without
   any Unicode tables of our own.
4. **Generate labels** (`labelalpha`, `extradate`, `uniquename`
   approximations — `biblatex-abnt` uses author-year, so `extradate` and
   `uniquename`/`uniquelist` are the hairy parts).
5. **Emit `.bbl`** in the biblatex ≥3.x format (`\entry{…}` with
   `\field`/`\name` lists). The format is versioned; pin to the biblatex
   release shipped in the busytex TL tree.

Estimated effort: 2–4 weeks for the `biblatex-abnt` subset with a golden-file
test suite (run real biber in Docker to produce expected `.bbl`s, byte-diff
against ours). Ship behind the same `PdfCompiler` interface as a bibtex8
alternative selected when the project's preamble asks for
`backend=biber`.

## Tier 1 (shipped-adjacent) and Tier 4 (shipped)

- Tier 1: biblatex with `backend=bibtex8` is officially supported by
  biblatex (reduced sorting/Unicode features). Documented as
  supported-with-caveats; add an e2e fixture when a biblatex project template
  enters scope.
- Tier 4: `.bbl` import — implemented in the orchestrator
  (`precompiledBbl`, §3.5 step 2) + the Importar `.bbl` affordance. Any
  biber document compiles today if the user runs biber once anywhere else
  (their machine, Overleaf, a GitHub Action).
