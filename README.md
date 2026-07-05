# UeceTexLive

> Edite e compile sua monografia UECE (abnTeX2) **inteiramente no navegador**.
> Seu texto nunca sai do seu computador.

UeceTexLive is a 100% static, frontend-only web app that loads the complete
[uecetex2](https://github.com/thiagodnf/uecetex2) ABNT template — chapters,
figures, bibliography, glossary, index, code listings — and compiles it to a
submission-quality PDF entirely in the browser via WebAssembly, edited through
a Notion-grade WYSIWYG editor built on Tiptap.

No backend, no accounts, no server compile, no telemetry. The engine
downloads once in the background (~150 MB compressed on the wire, ~220 MB in
the cache — see DEVIATIONS.md D12) and the app then works fully **offline**.

## One engine (busytex), two compile modes

| Mode | Pipeline | Speed | Resolves |
| --- | --- | --- | --- |
| **Rascunho** (draft) | busytex pdfTeX, single pass | ≈3× faster than full | layout only — citations show `[?]` |
| **Completa** (full) | busytex: pdfTeX + bibtex8 + makeindex ×2 | ~1–4 min | bibliography, glossary **and** index |

Both modes share the same engine instance and asset cache — switching modes
never re-downloads anything.

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
./scripts/vendor-busytex.sh         # busytex WASM + CTAN injection pack (~220 MB)
bun run dev                         # http://localhost:5173
```

The vendor scripts are idempotent and network-driven; their outputs are
gitignored (too large for the repo) except the small manifests.

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
| Compile engine | `src/features/compiler/` | `PdfCompiler` interface; busytex behind it (draft + full modes) |
| Pass orchestration | `src/features/compiler/orchestrator.ts` | latexmk-in-TS fixpoint + single-pass draft (pure, TDD) |
| busytex worker | `public/wasm/busytex/uecetexlive.worker.js` | see [`docs/busytex-integration.md`](docs/busytex-integration.md) |
| Service worker | `src/sw.ts` | app-shell precache + gzip-sidecar decompression for Pages (D12) |
| LaTeX ⇄ ProseMirror | `src/features/latex-mapping/` | byte-identity + stability invariants (pure, TDD) |
| WYSIWYG editor | `src/features/editor/` | Tiptap extension suite, node views, slash/bubble menus |
| Project model | `src/features/project/` | Zod schema, include graph, zip, reorder (pure, TDD) |
| Persistence | `src/features/persistence/db.ts` | IndexedDB (`uecetexlive`) |
| Shell / preview | `src/features/{shell,preview}/` | three-pane UI, PDF (pdf.js) + log panes |
| Biber research | [`docs/research/biber-wasm.md`](docs/research/biber-wasm.md) | tiers 2–3 assessment |

## License

MIT (see [`LICENSE`](LICENSE)). Third-party components — notably the
aggregate-licensed busytex/TeX Live bundles — retain their own licenses;
see [`THIRD_PARTY.md`](THIRD_PARTY.md).
