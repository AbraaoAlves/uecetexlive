#!/usr/bin/env bash
# Vendor TeX Live files into public/wasm/swiftlatex/texlive/ so the SwiftLaTeX
# WASM compiler works offline (its upstream texlive2.swiftlatex.com CDN is dead).
#
# The worker asks for `<endpoint>pdftex/<formatInt>/<filename>` (flat per format
# code, NO subdirs). We mirror that 1:1.
#
# Format codes used by SwiftLaTeX's worker (observed empirically — they do not
# match kpathsea upstream exactly):
#    3  .tfm    (TeX font metrics — requested WITHOUT extension, e.g. "cmr12")
#   10  .fmt    (pre-built engine format dump — recovered separately from Wayback)
#   11  .map    (font maps — pdftex.map at this path)
#   26  .sty .cls .def .cfg .clo .fd .ldf  (LaTeX class/style/definition files)
#   32  .pfb    (Type1 fonts — embedded into the PDF)
#   44  .enc    (font encoding vectors)
#   33  .vf     (virtual fonts)
# When the worker requests a font as "cmr12" with no extension, we serve the
# .tfm content from both "pdftex/3/cmr12" AND "pdftex/3/cmr12.tfm".
#
# Source: TeX Live tlnet per-package archives (xz). One HTTPS request per
# package — no rate-limiting, authoritative file layout, cached at CTAN's CDN.
#
# Add new TL packages to PACKAGES below as compile errors surface them.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="$ROOT/public/wasm/swiftlatex/texlive"
# Pin to the TeX Live 2020 historic archive: our recovered .fmt reports
# "LaTeX2e <2020-02-02>" — modern packages from current tlnet call kernel
# macros (e.g. \IfDocumentMetadataTF) that don't exist in 2020 LaTeX.
# Tried mirrors (first 200 wins, per-package fallback):
TLNET_MIRRORS=(
  "https://ftp.tu-chemnitz.de/pub/tug/historic/systems/texlive/2020/tlnet-final/archive"
  "https://ftp.math.purdue.edu/mirrors/ctan.org/historic/systems/texlive/2020/tlnet-final/archive"
  "https://mirror.ctan.org/historic/systems/texlive/2020/tlnet-final/archive"
)
TMP="${TMPDIR:-/tmp}/uecetexlive-tlnet-cache"
mkdir -p "$TMP" "$CACHE/pdftex/26" "$CACHE/pdftex/3" "$CACHE/pdftex/32" "$CACHE/pdftex/33" "$CACHE/pdftex/11" "$CACHE/pdftex/44" "$CACHE/pdftex/10"

# The .fmt is NOT in any TL archive — SwiftLaTeX built it. Sole known copy:
# Wayback snapshot of the dead upstream CDN (docs/prototype-compile-pipeline.md §6).
FMT="$CACHE/pdftex/10/swiftlatexpdftex.fmt"
if [[ ! -s "$FMT" ]]; then
  echo "Recovering swiftlatexpdftex.fmt from Wayback…"
  curl -sk -L --retry 3 -o "$FMT" \
    "https://web.archive.org/web/20220614101233id_/https://texlive2.swiftlatex.com/pdftex/10/swiftlatexpdftex.fmt"
  [[ -s "$FMT" ]] || { echo "FATAL: .fmt recovery failed" >&2; exit 1; }
fi

# TeX Live package names to vendor. Order doesn't matter; collisions favor
# the later one (rare; flag if surprising).
PACKAGES=(
  latex          # article.cls, size10.clo, fontmath.cfg, hyphen.cfg, ...
  latex-fonts    # default font metrics referenced by base
  # latex-base-dev — does not exist in TL 2020 historic
  cm             # Computer Modern TFMs (cmr10, cmr12, cmbx, cmsy, cmmi, ...)
  cm-super       # Type1 (.pfb) for CM in T1 encoding (~20 MB) + .map files
  ec             # T1-encoded fonts (ecrm1200 etc.) for fontenc{T1}
  amsfonts       # msam/msbm, cm extra (+ cm.map for OT1)
  psnfss         # PSNFSS .map entries
  pdftex         # dummy-space.map + base pdftex bits
  ltxmisc        # misc LaTeX bits some packages pull in
  geometry
  setspace
  tools          # indentfirst.sty + many others
  hyperref       # nameref.sty, pd1enc.def, hpdftex.def, ...
  iftex          # ifpdf/ifluatex/ifxetex shims
  url
  graphics
  graphics-cfg
  graphics-def
  pdftexcmds
  kvoptions
  kvsetkeys
  kvdefinekeys
  etexcmds
  ltxcmds
  infwarerr
  refcount
  gettitlestring
  atveryend
  auxhook
  bitset
  intcalc
  bigintcalc
  uniquecounter
  letltxmacro
  hobsub
  hopatch
  # --- hyperref full dep chain (TL 2020) ---
  pdfescape
  hycolor
  bookmark
  rerunfilecheck
  atbegshi
  l3backend      # l3backend-pdfmode.def — loaded at \begin{document}
  l3kernel       # additional L3 modules referenced from .fmt's preloaded layer
  oberdiek       # legacy bundle (provides many of the above as fallback)
  # --- uecetex2 / abnTeX2 set (INITIAL_PLAN §3.4; iterate from 404 log) ---
  abntex2
  memoir
  babel
  babel-portuges
  hyphen-portuguese
  amsmath
  amscls
  amsfonts
  glossaries
  tracklang
  mfirstuc
  xfor
  datatool
  substr
  fp
  xstring
  algorithm2e
  algorithms
  relsize
  multirow
  tocloft
  paracol
  pdfpages
  eso-pic
  appendix
  listings
  microtype
  caption
  booktabs
  lastpage
  etoolbox
  xcolor
  fancyvrb
  times
  courier
  helvetic
  symbol
  ifplatform
  catchfile
)

# File-extension → format-code map (only these are extracted)
ext_to_fmt() {
  case "$1" in
    sty|cls|def|cfg|clo|fd|ldf) echo 26 ;;
    tfm)                         echo 3  ;;
    vf)                          echo 33 ;;
    pfb)                         echo 32 ;;
    enc)                         echo 44 ;;
    map)                         echo 11 ;;
    *)                           echo "" ;;
  esac
}

fetched=0; cached=0; missing_pkg=0
extracted_total=0

for pkg in "${PACKAGES[@]}"; do
  tarball="$TMP/$pkg.tar.xz"
  if [[ ! -s "$tarball" ]]; then
    got=""
    for mirror in "${TLNET_MIRRORS[@]}"; do
      code=$(curl -sk -o "$tarball" -w "%{http_code}" --max-time 60 -L "$mirror/$pkg.tar.xz" || echo "000")
      if [[ "$code" == "200" ]]; then
        got=1
        break
      fi
      rm -f "$tarball"
    done
    if [[ -z "$got" ]]; then
      printf "  PKG-MISS  %-20s (no mirror returned 200)\n" "$pkg"
      missing_pkg=$((missing_pkg+1))
      continue
    fi
    fetched=$((fetched+1))
  else
    cached=$((cached+1))
  fi

  # One-shot decompress per package into a staging dir, then walk and copy.
  # Way faster than running `tar -xJf` per matching file (which redecompresses
  # the whole archive each time — minutes for big packages like cm-super).
  stage="$TMP/stage-$pkg"
  rm -rf "$stage"
  mkdir -p "$stage"
  if ! tar -xJf "$tarball" -C "$stage" 2>/dev/null; then
    printf "  EXTRACT-FAIL  %-20s\n" "$pkg"
    rm -rf "$stage"
    continue
  fi

  count=0
  while IFS= read -r f; do
    name="${f##*/}"
    ext="${name##*.}"
    fmt="$(ext_to_fmt "$ext")"
    [[ -z "$fmt" ]] && continue
    mv -f "$f" "$CACHE/pdftex/$fmt/$name"
    # Worker requests fonts WITHOUT extension (e.g. "cmr12" not "cmr12.tfm"),
    # so for font formats keep an extensionless duplicate alongside the named one.
    case "$ext" in
      tfm|vf|enc) cp -f "$CACHE/pdftex/$fmt/$name" "$CACHE/pdftex/$fmt/${name%.*}" ;;
    esac
    count=$((count+1))
  done < <(find "$stage" -type f \
    -regextype posix-extended \
    -regex '.*\.(sty|cls|def|cfg|clo|fd|ldf|tfm|vf|enc|map|pfb)$' \
    -not -path '*/source/*')
  rm -rf "$stage"
  printf "  ok        %-20s (%d files)\n" "$pkg" "$count"
  extracted_total=$((extracted_total+count))
done

# Synthesize unified pdftex.map. The engine asks for "pdftex.map" but TeX Live
# ships per-encoding maps (cm.map, cm-super-t1.map, etc.). updmap normally
# merges them at install time; we cat them.
{
  echo "% Papyru: synthesized pdftex.map (cat of per-encoding maps in pdftex/11/)"
  for m in "$CACHE"/pdftex/11/*.map; do
    [[ "$m" == *"/pdftex.map" ]] && continue
    [[ -f "$m" ]] || continue
    echo "% --- $(basename "$m") ---"
    cat "$m"
  done
} > "$CACHE/pdftex/11/pdftex.map"
echo
echo "Synthesized $CACHE/pdftex/11/pdftex.map ($(wc -l <"$CACHE/pdftex/11/pdftex.map") lines)"

echo
echo "Summary: $fetched packages downloaded, $cached reused from $TMP,"
echo "         $missing_pkg packages not found, $extracted_total files extracted."
echo "Cache layout:"
for d in "$CACHE"/pdftex/*/; do
  printf "  %s  %d files\n" "${d#$CACHE/}" "$(find "$d" -maxdepth 1 -type f | wc -l)"
done
