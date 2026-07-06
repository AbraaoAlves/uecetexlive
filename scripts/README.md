# scripts/

## Order of execution

```
vendor-uecetex2.sh   ┐
vendor-busytex.sh    ├─ independent of each other — write to disjoint dirs
sync-texlive-cache.sh┘  (public/templates/uecetex2, public/wasm/busytex,
                         public/wasm/swiftlatex/texlive). Order among the
                         three doesn't matter; all are idempotent (safe to
                         re-run, skip/replace only what changed).
        │
        ▼
   bun run build         Vite copies public/ → dist/, and reads
                         public/wasm + public/templates to compute the
                         service-worker's vendor cache-version hash
                         (src/build/vendor-hash.ts) — must run AFTER the
                         three vendor scripts above, or the hash (and the
                         built app) won't reflect real vendored content.
        │
        ▼
precompress-wasm.sh    Only exists after a build — operates on
  dist/wasm/busytex     dist/wasm/busytex/*, not public/. Deploy-only
                         (gzip sidecars for GitHub Pages, which can't
                         compress large binaries itself; see DEVIATIONS.md D12).
```

Not part of the chain above:

- **`check-agpl-compliance.sh`** — reads only git-committed files
  (`public/wasm/swiftlatex/{LICENSE,PdfTeXEngine.js,swiftlatexpdftex.js}`,
  `packages/compiler/README.md`). No vendoring dependency; safe to run
  standalone, any time.
- **`reference-build.sh`** — depends on `vendor-uecetex2.sh` having run at
  least once (needs its git-clone cache at
  `$TMPDIR/uecetexlive-vendor/uecetex2`; fails with a clear message
  otherwise). Builds a real `latexmk` PDF via Docker and writes
  `e2e/fixtures/reference.{json,bbl,txt}` for the `compile-full.spec.ts`
  regression gate. **Manual/local-only** — not called by any CI workflow;
  you run it and commit the regenerated fixtures when the template changes
  structurally enough to need a new reference.
- **`publish-packages.sh`** — publishes `@papyru/{latex-mapping,project-model,
  compiler,editor}` to npm in dependency order (`package_extraction.md`,
  Fase 4). Validates each package is out of workspace-dev mode (version
  bumped, `exports` pointing at `dist/`) before building, running `check`,
  and `check-agpl-compliance.sh`. Does not edit `version`/`exports` itself —
  that bump is a manual release decision. **Manual/local-only**, run by a
  human when deciding to cut a release; supports `--dry-run` and `--yes`.

## Who calls what

| Workflow | Vendors first? | Then | Notes |
| --- | --- | --- | --- |
| `ci.yml` (`check` job) | no | `bun run check`, `check-agpl-compliance.sh`, `build-storybook` | Doesn't need vendored assets. |
| `ci.yml` (`e2e` job) | yes, if `actions/cache` misses | `bun run build`, `playwright test --project=ui` | Cache keyed on the vendor scripts' content hash. |
| `e2e-full.yml` | yes, if `actions/cache` misses | `bun run build`, `playwright test --project=full-compile` | Same cache key as `ci.yml`'s `e2e` job — they share the cache entry. Nightly cron + path-filtered PR trigger, since these tests do real multi-minute WASM compiles. |
| `deploy.yml` | yes, unconditionally | `bun run build`, `precompress-wasm.sh dist/wasm/busytex`, 404.html copy, storybook build | Runs the vendor scripts every time (their own internal idempotency — e.g. size-checked downloads — makes a cache hit a fast no-op); only this workflow's cache key excludes `public/templates/uecetex2`, so `vendor-uecetex2.sh` always re-clones (cheap, small repo). |

## Why these aren't wired into `postinstall`/`postbuild`

Deliberately not automatic. `bun install` and `bun run build` both run in
contexts that don't need ~300 MB of vendored WASM/TeX Live data (e.g. the
`check` job above, or a developer installing a dependency bump) — baking
vendoring into `postinstall` would tax every one of those with the full
download, and bypass the CI cache-hit short-circuit that skips vendoring
entirely when nothing changed. Same reasoning for `precompress-wasm.sh` and
`postbuild`: it's GitHub Pages-specific and CPU-costly (gzip -9 over ~220 MB),
wasted work for any build that isn't the actual deploy.
