# UeceTexLive

> Edite e compile sua monografia UECE (abnTeX2) **inteiramente no navegador**.
> Seu texto nunca sai do seu computador.

UeceTexLive is a 100% static, frontend-only web app that loads the complete
[uecetex2](https://github.com/thiagodnf/uecetex2) ABNT template — chapters,
figures, bibliography, glossary, index, code listings — and compiles it to a
submission-quality PDF entirely in the browser via WebAssembly, edited through
a Notion-grade WYSIWYG editor built on Tiptap.

No backend, no accounts, no server compile, no telemetry. The Completa
engine downloads once in the background shortly after boot (~150 MB
compressed on the wire, ~220 MB in the cache — see `DEVIATIONS.md` D12); the
app then works fully **offline**.

## Two compile engines, one button

| Mode | Engine | Speed | Resolves |
| --- | --- | --- | --- |
| **Rascunho** (draft) | SwiftLaTeX pdfTeX (TL 2020) | ~3 s | layout only — citations show `[?]` |
| **Completa** (full) | busytex: pdfTeX + bibtex8 + makeindex ×2 | ~1–4 min (after a one-time ~150 MB compressed download) | bibliography, glossary **and** index |

## Quickstart (users)

Open the deployed app. The uecetex2 template is already there. Edit chapters
in the visual editor (or toggle to raw LaTeX with `Mod+E`), press **Compilar**
(`Mod+Enter`), preview the PDF, download it or export the project as a `.zip`.

Have a biber document? Run biber once elsewhere and **Importar .bbl** — the
full build will skip BibTeX and use your precompiled bibliography (§3.6 Tier 4).

## Quickstart (contributors)

```bash
bun install
./scripts/vendor-uecetex2.sh        # template snapshot (pinned commit)
./scripts/vendor-busytex.sh         # busytex WASM + CTAN injection pack (~216 MB)
./scripts/sync-texlive-cache.sh     # SwiftLaTeX draft engine TL2020 slice (~85 MB)
bun run dev                         # http://localhost:5173
```

The vendor scripts are idempotent and network-driven; their outputs are
gitignored (too large for the repo) except the small manifests and the
patched SwiftLaTeX engine files.

```bash
bun run check          # biome + tsc + vitest (the CI gate)
bun run e2e            # Playwright against the built app (needs vendored assets)
bun run storybook      # component gallery
```

## Architecture map

The full build specification is [`INITIAL_PLAN.md`](INITIAL_PLAN.md). Deviations
from it (all the hard-won reality) are in [`DEVIATIONS.md`](DEVIATIONS.md).

| Area | Where | Notes |
| --- | --- | --- |
| Compile engines | `packages/compiler/` | `PdfCompiler` interface; busytex + SwiftLaTeX behind it |
| Pass orchestration | `packages/compiler/src/orchestrator.ts` | latexmk-in-TS fixpoint (pure, TDD) |
| busytex worker | `public/wasm/busytex/uecetexlive.worker.js` | see [`docs/busytex-integration.md`](docs/busytex-integration.md) |
| SwiftLaTeX pipeline | [`docs/prototype-compile-pipeline.md`](docs/prototype-compile-pipeline.md) | the TeX Live URL contract + 3 engine patches |
| Service worker | `src/sw.ts` | app-shell precache + gzip-sidecar decompression for the busytex payload on Pages (D12) |
| LaTeX ⇄ ProseMirror | `packages/latex-mapping/` | byte-identity + stability invariants (pure, TDD) |
| WYSIWYG editor | `packages/editor/` | Tiptap extension suite, node views, slash/bubble menus |
| Project model | `packages/project-model/` (adapters do app em `src/features/project/`) | Zod schema, include graph, zip, reorder (pure, TDD) |
| Persistence | `src/features/persistence/db.ts` | IndexedDB (`uecetexlive`) |
| Shell / preview | `src/features/{shell,preview}/` | three-pane UI, PDF (pdf.js) + log panes |
| Biber research | [`docs/research/biber-wasm.md`](docs/research/biber-wasm.md) | tiers 2–3 assessment |

## License

MIT (see [`LICENSE`](LICENSE)). Third-party components — notably the AGPL-3.0
SwiftLaTeX engine (served patched) and the aggregate-licensed busytex/TeX Live
bundles — retain their own licenses; see [`THIRD_PARTY.md`](THIRD_PARTY.md).
