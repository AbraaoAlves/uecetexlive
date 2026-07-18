# Third-party licenses & attribution

UeceTexLive bundles and links a number of open-source components. This file
is the authoritative notice list (§13 of INITIAL_PLAN); the `/sobre` route
surfaces the user-facing summary.

| Component | License | Obligation & how we meet it |
| --- | --- | --- |
| **uecetex2** template (`public/templates/uecetex2/`) | LPPL 1.3 (upstream `LICENSE`, vendored verbatim) | File kept intact; credited in `/sobre` and here. Pinned at commit `4c4ab76ded7bcbf666250f1006558b95e2dea683` of the fork `abraaoalves/uecetex2` (derived from upstream `thiagodnf/uecetex2`); source of truth is `public/templates/uecetex2/manifest.json`. |
| **abnTeX2** (`abntex2.cls`, `abntex2cite.sty`, `abntex2-alf.bst`) | LPPL 1.3 | Served unmodified from the CTAN injection pack and the TL2020 slice; attribution here. |
| **busytex** code/glue (`busytex.js`, `busytex_pipeline.js`, `busytex_worker.js`) | MIT | Notice retained; source: <https://github.com/busytex/busytex>. |
| **busytex `.wasm` + `.data` bundles** | Aggregate of TeX Live component licenses (GPL / LPPL / permissive) | Served **unmodified**; source repo linked above and in `/sobre`. |
| **TeX Live 2020 slice** (`public/wasm/swiftlatex/texlive/`) | Aggregate of TeX Live component licenses | Redistribution of unmodified TL package files from historic tlnet; per-package upstreams on CTAN. |
| **cm-super** (typewriter subset) | GPL (with font exception) | Unmodified `.pfb`/`.enc` files served for embedding. |
| **SwiftLaTeX engine** (`PdfTeXEngine.js`, `swiftlatexpdftex.js`, `swiftlatexpdftex.wasm`) | **AGPL-3.0** | We serve **patched** artifacts. The three patches are documented and diffed in `docs/prototype-compile-pipeline.md` §2 and `DEVIATIONS.md` D7; source: <https://github.com/SwiftLaTeX/SwiftLaTeX>. The draft engine is the isolable/removable piece if distribution posture ever requires it. |
| **Tiptap** core + extensions | MIT | Notice. |
| **unified-latex** | MIT | Notice. |
| **KaTeX** | MIT | Notice; CSS + fonts bundled. |
| **pdf.js** (`pdfjs-dist`) | Apache-2.0 | Notice. |
| **fflate** | MIT | Notice. |
| **zod**, **idb**, **@retorquere/bibtex-parser**, **clsx**, **tailwind-merge**, **lucide-react**, **motion**, **@radix-ui/\*** | MIT | Notices. |
| **React**, **react-dom**, **@tanstack/react-router** | MIT | Notices. |

UeceTexLive's own source is MIT (`LICENSE`).

<!-- TODO(humano): documentar por que o vendor usa o fork abraaoalves/uecetex2
     em vez do upstream thiagodnf/uecetex2 diretamente — o fork tem
     modificações próprias? Se sim, quais e por quê? -->
