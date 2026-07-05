#!/usr/bin/env bash
# Gzip sidecars for the big busytex binaries (DEVIATIONS.md D12).
#
# GitHub Pages serves .data/.wasm uncompressed (no header control, no
# on-the-fly compression for binary types), so the deploy publishes
# `file.gz` next to each large file and the service worker (src/sw.ts)
# fetches the sidecar and decompresses it client-side. Originals are kept
# (-k) as the fallback for uncontrolled/first-load fetches.
#
# Must run AFTER `bun run build` — operates on dist/, not public/ (see
# scripts/README.md for the full vendor → build → precompress order).
#
# Usage: ./scripts/precompress-wasm.sh [dist/wasm/busytex]
set -euo pipefail

dir="${1:-dist/wasm/busytex}"
[ -d "$dir" ] || { echo "precompress-wasm: $dir not found (build first)" >&2; exit 1; }

total_before=0
total_after=0
for f in "$dir"/*.data "$dir"/busytex.wasm; do
  [ -f "$f" ] || continue
  gzip -9 -kf "$f"
  before=$(stat -c%s "$f")
  after=$(stat -c%s "$f.gz")
  total_before=$((total_before + before))
  total_after=$((total_after + after))
  printf '%s: %d -> %d bytes (%d%%)\n' "$(basename "$f")" "$before" "$after" \
    $((after * 100 / before))
done

printf 'total: %d -> %d bytes (%d%%)\n' "$total_before" "$total_after" \
  $((total_after * 100 / total_before))
