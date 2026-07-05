# Third-party licenses & attribution

UeceTexLive bundles and links a number of open-source components. This file
is the authoritative notice list (§13 of INITIAL_PLAN); the `/sobre` route
surfaces the user-facing summary.

| Component | License | Obligation & how we meet it |
| --- | --- | --- |
| **uecetex2** template (`public/templates/uecetex2/`) | LPPL 1.3 (upstream `LICENSE`, vendored verbatim) | File kept intact; credited in `/sobre` and here. Pinned at commit `39e8c8a0312788d72311e3b0157ff0564fb74eaf`. |
| **abnTeX2** (`abntex2.cls`, `abntex2cite.sty`, `abntex2-alf.bst`) | LPPL 1.3 | Served unmodified from the CTAN injection pack; attribution here. |
| **busytex** code/glue (`busytex.js`, `busytex_pipeline.js`, `busytex_worker.js`) | MIT | Notice retained; source: <https://github.com/busytex/busytex>. |
| **busytex `.wasm` + `.data` bundles** | Aggregate of TeX Live component licenses (GPL / LPPL / permissive) | Served **unmodified**; source repo linked above and in `/sobre`. |
| **cm-super** (typewriter subset) | GPL (with font exception) | Unmodified `.pfb`/`.enc` files served for embedding. |
| **Tiptap** core + extensions | MIT | Notice. |
| **unified-latex** | MIT | Notice. |
| **KaTeX** | MIT | Notice; CSS + fonts bundled. |
| **pdf.js** (`pdfjs-dist`) | Apache-2.0 | Notice. |
| **fflate** | MIT | Notice. |
| **zod**, **idb**, **@retorquere/bibtex-parser**, **clsx**, **tailwind-merge**, **lucide-react**, **motion**, **@radix-ui/\*** | MIT | Notices. |
| **React**, **react-dom**, **@tanstack/react-router** | MIT | Notices. |

UeceTexLive's own source is MIT (`LICENSE`).

> The AGPL-3.0 **SwiftLaTeX** draft engine and its TeX Live 2020 slice were
> **removed** in July 2026 (`DEVIATIONS.md` D11) — the draft mode now runs on
> busytex. No AGPL-licensed code ships with the app.
