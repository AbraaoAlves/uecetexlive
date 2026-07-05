#!/usr/bin/env bash
# Vendors the uecetex2 template (pinned commit) into public/templates/uecetex2/.
# Idempotent: output is deterministic; run twice → no diff (§5.5 / Gate G1).
# No dependency on the other vendor-*.sh scripts (see scripts/README.md) —
# just run before `bun run build`.
set -euo pipefail

cd "$(dirname "$0")/.."

REPO="https://github.com/abraaoalves/uecetex2"
PINNED_COMMIT="c644a4350e9c0b486bb021652302301e3dd557e6"
DEST="public/templates/uecetex2"
CACHE="${TMPDIR:-/tmp}/uecetexlive-vendor/uecetex2"

if [ ! -d "$CACHE/.git" ]; then
  mkdir -p "$(dirname "$CACHE")"
  git clone --quiet "$REPO" "$CACHE"
fi
if ! git -C "$CACHE" cat-file -e "$PINNED_COMMIT^{commit}" 2>/dev/null; then
  git -C "$CACHE" fetch --quiet origin
fi
git -C "$CACHE" checkout --quiet "$PINNED_COMMIT"

rm -rf "$DEST"
mkdir -p "$DEST/files"

# Compile inputs only (§2). Pruned per R13: doc/ (10+MB scanned norms),
# Dockerfile, .github/, figuras/ficha-catalografica.doc, plus repo plumbing
# (.gitignore, README.md, Makefile, .latexmkrc — the .latexmkrc logic lives
# in src/features/compiler/orchestrator.ts).
rsync -a \
  --exclude '.git' \
  --exclude 'doc' \
  --exclude 'Dockerfile' \
  --exclude '.github' \
  --exclude '.gitignore' \
  --exclude 'README.md' \
  --exclude 'Makefile' \
  --exclude '.latexmkrc' \
  --exclude 'figuras/ficha-catalografica.doc' \
  --exclude 'reference.*' \
  --exclude 'pages.txt' \
  --exclude 'build' \
  "$CACHE/" "$DEST/files/"

# Belt-and-braces: a hard git-clean of the pinned checkout removes any stray
# build artifacts a prior reference-build left in the clone.
git -C "$CACHE" clean -fdq -e reference.pdf -e reference.bbl 2>/dev/null || true

# LICENSE verbatim at the template root too (§13).
cp "$CACHE/LICENSE" "$DEST/LICENSE"

# manifest.json — zod-validated by the seed loader (§5.5).
bun -e '
const { readdirSync, statSync, readFileSync, writeFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { join, relative } = require("node:path");
const root = "'"$DEST"'/files";
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else {
      const bytes = readFileSync(p);
      files.push({
        path: relative(root, p),
        size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
};
walk(root);
const manifest = {
  name: "uecetex2",
  entry: "documento.tex",
  source: "'"$REPO"'",
  commit: "'"$PINNED_COMMIT"'",
  files,
};
writeFileSync("'"$DEST"'/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest: ${files.length} files`);
'

echo "vendored uecetex2 @ ${PINNED_COMMIT} -> ${DEST}"
