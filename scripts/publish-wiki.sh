#!/usr/bin/env bash
# Publica docs/wiki/ na GitHub Wiki (uecetexlive.wiki.git).
# Pré-requisito: a primeira página da Wiki já foi criada pela web (F0.2).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="docs/wiki"
[ -d "$SRC" ] || { echo "erro: $SRC não existe" >&2; exit 1; }
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git clone --depth 1 "git@github.com:AbraaoAlves/uecetexlive.wiki.git" "$TMP"
rsync -a --delete --exclude .git "$SRC"/ "$TMP"/
cd "$TMP"
git add -A
if git diff --cached --quiet; then
  echo "Wiki já está em dia."
else
  git commit -m "docs(wiki): publica docs/wiki@$(git -C "$OLDPWD" rev-parse --short HEAD)"
  git push
  echo "Wiki publicada."
fi
