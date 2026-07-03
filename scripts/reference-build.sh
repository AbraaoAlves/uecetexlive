#!/usr/bin/env bash
# Reference PDF (§10): compile upstream uecetex2 with real latexmk in Docker
# (upstream's own texlive image + latexmk line), then record page count +
# text hash into e2e/fixtures/reference.json for the compile-full gate.
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="${TMPDIR:-/tmp}/uecetexlive-vendor/uecetex2"
OUT="e2e/fixtures"
mkdir -p "$OUT"

[ -d "$SRC/.git" ] || { echo "run scripts/vendor-uecetex2.sh first"; exit 1; }

if [ ! -s "$SRC/reference.pdf" ]; then
  docker run --rm -v "$SRC":/build -w /build texlive/texlive:latest \
    sh -c "latexmk -pdf -outdir=/tmp/ref-build documento.tex && cp /tmp/ref-build/documento.pdf /build/reference.pdf"
fi

# Page count + text via pdfjs-dist on the host (the texlive image has no poppler).
bun scripts/pdf-metrics.ts "$SRC/reference.pdf" --text > "$OUT/reference-metrics.json"

bun -e '
const { readFileSync, writeFileSync, rmSync } = require("node:fs");
const metrics = JSON.parse(readFileSync("'"$OUT"'/reference-metrics.json", "utf-8"));
writeFileSync("'"$OUT"'/reference.txt", metrics.text);
writeFileSync(
  "'"$OUT"'/reference.json",
  JSON.stringify(
    {
      pages: metrics.pages,
      // Strings the e2e asserts inside the compiled PDF text layer
      // (verified present in reference.txt at generation time):
      probes: {
        // Appears only in the resolved bibliography (citations render as
        // "(Lamport, 1986)"; the reference list renders "LAMPORT, L."):
        bibliography: "LAMPORT, L.",
        glossaryTerm: "Ambiguidade",
      },
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);
rmSync("'"$OUT"'/reference-metrics.json");
console.log(`reference.json written, pages=${metrics.pages}`);
'
