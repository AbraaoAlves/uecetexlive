# Third-party licenses & attribution

UeceTexLive bundles and links a number of open-source components. This file
is the authoritative notice list; the `/sobre` route surfaces the
user-facing summary.

| Component | License | Obligation & how we meet it |
| --- | --- | --- |
| **uecetex2** template (`public/templates/uecetex2/`) | LPPL 1.3 (upstream `LICENSE`, vendored verbatim) | File kept intact; credited in `/sobre` and here. Pinned at commit `4c4ab76ded7bcbf666250f1006558b95e2dea683` of the fork `abraaoalves/uecetex2` (derived from upstream `thiagodnf/uecetex2`); source of truth is `public/templates/uecetex2/manifest.json`. |
| **abnTeX2** (`abntex2.cls`, `abntex2cite.sty`, `abntex2-alf.bst`) | LPPL 1.3 | Served unmodified from the CTAN injection pack and the TL2020 slice; attribution here. |
| **busytex** code/glue (`busytex.js`, `busytex_pipeline.js`, `busytex_worker.js`) | MIT | Notice retained; source: <https://github.com/busytex/busytex>. |
| **busytex `.wasm` + `.data` bundles** | Aggregate of TeX Live component licenses (GPL / LPPL / permissive) | Served **unmodified**; source repo linked above and in `/sobre`. |
| **TeX Live 2020 slice** (`public/wasm/swiftlatex/texlive/`) | Aggregate of TeX Live component licenses | Redistribution of unmodified TL package files from historic tlnet; per-package upstreams on CTAN. |
| **cm-super** (typewriter subset) | GPL (with font exception) | Unmodified `.pfb`/`.enc` files served for embedding. |
| **SwiftLaTeX engine** (`PdfTeXEngine.js`, `swiftlatexpdftex.js`, `swiftlatexpdftex.wasm`) | **AGPL-3.0** | We serve **patched** artifacts. The three patches are documented and diffed in `docs/prototype-compile-pipeline.md` §2 and `DEVIATIONS.md` D7; source: <https://github.com/SwiftLaTeX/SwiftLaTeX>. The draft engine is the isolable/removable piece if distribution posture ever requires it. |
| **mupdf.js** (`mupdf`, `mupdf-wasm.wasm`) | **AGPL-3.0** | Served **unmodified** from the npm package; source: <https://github.com/ArtifexSoftware/mupdf.js>. Loaded only when the student imports a PDF (never at boot) by `packages/inverse-core`. If a patch ever becomes necessary, document and diff it as in the SwiftLaTeX row. |
| **@noble/hashes** | MIT | Notice; SHA-256 for the PDF import path. |
| **Tiptap** core + extensions | MIT | Notice. |
| **unified-latex** | MIT | Notice. |
| **KaTeX** | MIT | Notice; CSS + fonts bundled. |
| **pdf.js** (`pdfjs-dist`) | Apache-2.0 | Notice. |
| **fflate** | MIT | Notice. |
| **zod**, **idb**, **@retorquere/bibtex-parser**, **clsx**, **tailwind-merge**, **lucide-react**, **motion**, **@radix-ui/\*** | MIT | Notices. |
| **React**, **react-dom**, **@tanstack/react-router** | MIT | Notices. |

UeceTexLive's own source is MIT (`LICENSE`, plain MIT text only — no
third-party notices there, to keep GitHub's license detector matching MIT
cleanly). The AGPL-3.0 SwiftLaTeX engine, the AGPL-3.0 mupdf.js reader and
the aggregate-licensed busytex/TeX Live bundles above are the notable
third-party exceptions.

**One first-party exception:** `packages/inverse-core/` — the PDF → project
importer — is our own code, but it is distributed under **AGPL-3.0-or-later**
rather than MIT, because `extract.ts` links mupdf.js and the combined work
inherits mupdf's terms. The package's `package.json` and `README.md` state
this, and `scripts/check-agpl-compliance.sh` fails the build if either stops
saying so.

**Por que um fork, e não o upstream direto:** o commit vendorado
(`4c4ab76d…`) está 2 commits à frente do `master` de `thiagodnf/uecetex2`:
`c644a43` alinha o conteúdo dos templates ao Guia UECE 2026 (referenciando
suas regras e estrutura em metodologia, resultados e seções relacionadas) e
é objeto do PR aberto
[thiagodnf/uecetex2#59](https://github.com/thiagodnf/uecetex2/pull/59),
ainda não mesclado a montante em 2026-07-19; `4c4ab76` em si é um ajuste
cosmético (espaçamento/escala do brasão em `imprimirbrasoes`), também não
proposto a montante. Ambos são de autoria do mesmo mantenedor do
UeceTexLive. O vendor usa o fork para obter essas atualizações de imediato,
sem esperar a revisão upstream.
