#!/usr/bin/env bash
# Reference PDF (§10): compile upstream uecetex2 with real latexmk in Docker
# (upstream's own texlive image + latexmk line), then record page count +
# text hash into e2e/fixtures/reference.json for the compile-full gate.
#
# Manual/local-only — no CI workflow calls this (see scripts/README.md).
# Run it yourself and commit the regenerated e2e/fixtures/reference.* when
# the template changes enough to need a new reference. Requires
# scripts/vendor-uecetex2.sh to have run first (checked below) and Docker.
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="${TMPDIR:-/tmp}/uecetexlive-vendor/uecetex2"
OUT="e2e/fixtures"
# Build artifacts go to a scratch dir OUTSIDE the git clone, so the next
# vendor-uecetex2.sh run does not pick them up into the template.
WORK="${TMPDIR:-/tmp}/uecetexlive-refbuild"
mkdir -p "$OUT" "$WORK"

[ -d "$SRC/.git" ] || { echo "run scripts/vendor-uecetex2.sh first"; exit 1; }

# Always rebuild: reusing a PDF left in /tmp can silently pair a new template
# with stale page/text metrics.
docker run --rm -v "$SRC":/src:ro -v "$WORK":/out texlive/texlive:latest \
  sh -c "cp -r /src /tmp/build && cd /tmp/build && latexmk -pdf -outdir=/tmp/rb documento.tex && cp /tmp/rb/documento.pdf /out/reference.pdf && cp /tmp/rb/documento.bbl /out/reference.bbl"
# The Tier-4 .bbl e2e fixture is produced here too (real biber-less bibtex).
[ -s "$WORK/reference.bbl" ] && cp "$WORK/reference.bbl" "$OUT/documento.bbl"

# Page count + text via pdfjs-dist on the host (the texlive image has no poppler).
bun scripts/pdf-metrics.ts "$WORK/reference.pdf" --text > "$OUT/reference-metrics.json"

bun -e '
const { readFileSync, writeFileSync, rmSync } = require("node:fs");
const metrics = JSON.parse(readFileSync("'"$OUT"'/reference-metrics.json", "utf-8"));
const probes = {
  // Appears only in the resolved bibliography (citations render as
  // "(Lamport, 1986)"; the reference list renders "LAMPORT, L."):
  bibliography: "LAMPORT, L.",
};
for (const [name, probe] of Object.entries(probes)) {
  if (!metrics.text.includes(probe)) {
    throw new Error(`reference probe ${name} is absent from the generated PDF: ${probe}`);
  }
}
writeFileSync("'"$OUT"'/reference.txt", metrics.text);
writeFileSync(
  "'"$OUT"'/reference.json",
  JSON.stringify(
    {
      pages: metrics.pages,
      // Strings the e2e asserts inside the compiled PDF text layer. The loop
      // above guarantees reference.json cannot claim a probe absent from the
      // reference build.
      probes,
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);
rmSync("'"$OUT"'/reference-metrics.json");
console.log(`reference.json written, pages=${metrics.pages}`);
'
