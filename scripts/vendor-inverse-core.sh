#!/usr/bin/env bash
# Vendors the uecetex-inverse core (pinned commit) into packages/inverse-core/.
# Only the pure modules: the disk shells (cli.ts, emit-fs.ts) stay out, so the
# package never pulls node:* into a browser bundle.
# Idempotent: output is deterministic; run twice → no diff.
# No dependency on the other vendor-*.sh scripts (see scripts/README.md).
set -euo pipefail

cd "$(dirname "$0")/.."

REPO="${INVERSE_REPO:-../uecetex-inverse}"
DEST="packages/inverse-core"

if [ ! -d "$REPO/.git" ]; then
  echo "uecetex-inverse não encontrado em $REPO (use INVERSE_REPO=...)" >&2
  exit 1
fi

COMMIT="$(git -C "$REPO" rev-parse HEAD)"
if [ -n "$(git -C "$REPO" status --porcelain)" ]; then
  echo "o repositório de origem tem mudanças não commitadas — vendore de um commit limpo" >&2
  exit 1
fi

rm -rf "$DEST/src"
mkdir -p "$DEST/src"

# Os módulos puros, e só eles: cli.ts e emit-fs.ts usam node:* de propósito.
for f in ir.ts semantic.ts extract.ts classify.ts emit.ts cite.ts bibkey.ts text-util.ts index.ts; do
  cp "$REPO/src/$f" "$DEST/src/$f"
done
cp "$REPO/LICENSE" "$DEST/LICENSE" 2>/dev/null || true

# Guarda de fumaça: nenhum node:* pode entrar no que vai para o navegador.
if grep -REn '^\s*import[^;]*from\s+"node:' "$DEST/src"; then
  echo "módulo vendorado importa node:* — corrija na origem antes de vendorar" >&2
  exit 1
fi

# manifest.json — commit de origem e inventário, no padrão dos outros vendors.
bun -e '
const { readdirSync, readFileSync, writeFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { join } = require("node:path");
const root = "'"$DEST"'/src";
const files = readdirSync(root).sort().map((name) => {
  const bytes = readFileSync(join(root, name));
  return { path: name, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
});
writeFileSync(
  "'"$DEST"'/manifest.json",
  JSON.stringify(
    {
      name: "uecetex-inverse-core",
      source: "https://github.com/AbraaoAlves/uecetex-inverse",
      commit: "'"$COMMIT"'",
      files,
    },
    null,
    2,
  ) + "\n",
);
'

echo "vendorado de $COMMIT"
