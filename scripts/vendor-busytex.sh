#!/usr/bin/env bash
# Vendors the busytex WASM toolchain (pinned release) into public/wasm/busytex/.
# Sizes verified ±20% against Appendix A.3 (queried from the release API on
# 2026-07-02); abnTeX2 presence asserted (risk K1). Idempotent: existing files
# with the right size are not re-downloaded.
# No dependency on the other vendor-*.sh scripts (see scripts/README.md) —
# just run before `bun run build`.
set -euo pipefail

cd "$(dirname "$0")/.."

BASE="https://github.com/busytex/busytex/releases/download/build_wasm_4499aa69fd3cf77ad86a47287d9a5193cf5ad993_7936974349_1"
DEST="public/wasm/busytex"
mkdir -p "$DEST"

# The worker glue (§3.3) is this repo's own code, but BusytexFullCompiler
# hardcodes its filename as part of @papyru/compiler's asset contract — it
# lives canonically in the package (packages/compiler/static/) so every
# consumer of the package, not just this app, gets the same copy.
cp packages/compiler/static/uecetexlive.worker.js "$DEST/uecetexlive.worker.js"

# name expected_bytes
ASSETS="
busytex.js 295606
busytex.wasm 30363063
busytex_pipeline.js 30380
busytex_worker.js 1241
texlive-basic.js 2068492
texlive-basic.data 104576512
ubuntu-texlive-latex-base.js 299539
ubuntu-texlive-latex-base.data 5741806
ubuntu-texlive-latex-recommended.js 337892
ubuntu-texlive-latex-recommended.data 9058527
ubuntu-texlive-latex-extra.js 1398581
ubuntu-texlive-latex-extra.data 49513577
ubuntu-texlive-fonts-recommended.js 353109
ubuntu-texlive-fonts-recommended.data 10264033
ubuntu-texlive-science.js 259829
ubuntu-texlive-science.data 9320179
texmf.cnf 40745
updmap.cfg 3887
dvipdfmx.cfg 8661
ubuntu-texlive-latex-extra.js.providespackage.txt 100144
ubuntu-texlive-science.js.providespackage.txt 14373
"

size_of() { stat -c%s "$1" 2>/dev/null || echo 0; }

echo "$ASSETS" | while read -r name expected; do
  [ -z "$name" ] && continue
  out="$DEST/$name"
  actual="$(size_of "$out")"
  if [ "$actual" != "$expected" ]; then
    echo "fetching $name…"
    curl -sSfL --retry 3 -o "$out" "$BASE/$name"
    actual="$(size_of "$out")"
  fi
  min=$((expected * 80 / 100))
  max=$((expected * 120 / 100))
  if [ "$actual" -lt "$min" ] || [ "$actual" -gt "$max" ]; then
    echo "SIZE MISMATCH: $name expected ~$expected got $actual (±20% violated)" >&2
    exit 1
  fi
done

# Risk K1 REALIZED (see DEVIATIONS.md): abnTeX2 is NOT inside any busytex
# .data bundle (Ubuntu ships it in texlive-publishers, which busytex does not
# build). tracklang (glossaries dep) is missing too. Contingency per §14/K1:
# fetch both from CTAN's TL archive and inject into the compile memfs at
# runtime (kpathsea resolves cwd files first).
INJECT="$DEST/inject"
mkdir -p "$INJECT"
CTAN="https://mirror.ctan.org/systems/texlive/tlnet/archive"
for pkg in abntex2 tracklang babel-portuges microtype; do
  if [ ! -f "$INJECT/.$pkg.done" ]; then
    echo "fetching CTAN $pkg…"
    tmp="$(mktemp -d)"
    curl -sSfL --retry 3 -o "$tmp/$pkg.tar.xz" "$CTAN/$pkg.tar.xz"
    tar -xJf "$tmp/$pkg.tar.xz" -C "$tmp"
    # Flatten runtime files: TeX inputs + BibTeX styles. cwd lookup needs
    # flat names, and none of these packages have name collisions. TL tlnet
    # archives have no texmf-dist/ prefix: paths are tex/latex/<pkg>/…
    find "$tmp/tex" "$tmp/bibtex" -type f \
      \( -name '*.sty' -o -name '*.cls' -o -name '*.def' -o -name '*.bst' \
         -o -name '*.bib' -o -name '*.tex' -o -name '*.ldf' -o -name '*.ini' -o -name '*.cfg' \) \
      -exec cp {} "$INJECT/" \; 2>/dev/null || true
    rm -rf "$tmp"
    touch "$INJECT/.$pkg.done"
  fi
done

if [ ! -f "$INJECT/abntex2.cls" ]; then
  echo "FATAL: abntex2.cls missing after CTAN injection fetch (risk K1)" >&2
  exit 1
fi

# l3backend-pdfmode.def stub: busytex's bundled l3kernel exposes "pdfmode" as
# a backend choice but its alias-resolution to l3backend-pdftex/luatex.def is
# incomplete, so the deferred \begin{document} load asks for a file no real
# TeX Live release ships (docs/prototype-compile-pipeline.md §7 — same trap
# hit by the SwiftLaTeX .fmt; same empty-stub fix, see
# public/wasm/swiftlatex/texlive/pdftex/26/l3backend-pdfmode.def).
printf '%s\n' '\endinput' > "$INJECT/l3backend-pdfmode.def"

# cm-super typewriter subset (see DEVIATIONS.md): the busytex bundles ship no
# cm-super, so T1-encoded typewriter (ectt*, used by listings/\texttt under
# fontenc T1) has no Type1 outline and pdfTeX dies trying to fork mktexpk.
# We vendor just the sftt faces + T1 enc + the ectt map lines; the worker
# writes a merged pdftex.map into the compile cwd (TEXFONTMAPS searches
# $TEXMFDOTDIR first, shadowing the tree map).
if [ ! -f "$INJECT/.cm-super.done" ]; then
  echo "fetching CTAN cm-super (typewriter subset)…"
  CMS_CACHE="${TMPDIR:-/tmp}/uecetexlive-vendor/cm-super.tar.xz"
  mkdir -p "$(dirname "$CMS_CACHE")"
  [ -s "$CMS_CACHE" ] || curl -sSfL --retry 3 -o "$CMS_CACHE" "$CTAN/cm-super.tar.xz"
  tmp="$(mktemp -d)"
  tar -xJf "$CMS_CACHE" -C "$tmp"
  cp "$tmp"/fonts/type1/public/cm-super/sftt*.pfb "$INJECT/"
  cp "$tmp"/fonts/enc/dvips/cm-super/cm-super-t1.enc "$INJECT/"
  grep '^ectt' "$tmp"/fonts/map/dvips/cm-super/cm-super-t1.map \
    > "$DEST/ectt-map-fragment.txt"
  rm -rf "$tmp"
  touch "$INJECT/.cm-super.done"
fi

# Inject manifest: the busytex compiler fetches these by name at warmup.
bun -e '
const { readdirSync, writeFileSync } = require("node:fs");
const names = readdirSync("'"$INJECT"'")
  .filter((n) => !n.startsWith(".") && n !== "manifest.json")
  .sort();
writeFileSync("'"$INJECT"'/manifest.json", JSON.stringify(names, null, 2) + "\n");
console.log(`inject manifest: ${names.length} files`);
'

# sha256 manifest (committed; the binaries themselves are gitignored).
bun -e '
const { readFileSync, writeFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const names = `'"$ASSETS"'`.trim().split("\n").map((l) => l.trim().split(" ")[0]);
const files = names.map((name) => {
  const bytes = readFileSync("'"$DEST"'/" + name);
  return {
    name,
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
});
writeFileSync(
  "'"$DEST"'/manifest.json",
  JSON.stringify({ base: "'"$BASE"'", files }, null, 2) + "\n",
);
console.log(`manifest: ${files.length} assets`);
'

echo "vendored busytex -> ${DEST}"
