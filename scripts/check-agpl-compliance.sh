#!/usr/bin/env bash
# Gate de compliance AGPL.
#
# Objetivo: NÃO impedir o engine SwiftLaTeX (AGPL-3.0) de existir — impedir
# que ele exista *silenciosamente*. Falha quando o engine aparece sem o
# acompanhamento obrigatório:
#   (a) LICENSE (AGPL-3.0) publicado junto aos assets vendorizados;
#   (b) README do pacote compiler declarando a licença mista + link para o
#       Corresponding Source dos patches;
#   (c) todo arquivo de engine alterado localmente carrega a marcação
#       `papyru:` / `Papyru patch:` (rastreabilidade dos patches).
#
# Mesma disciplina para o segundo componente AGPL, o leitor mupdf.js usado
# pelo caminho PDF→projeto: o pacote que o consome declara a licença e o
# THIRD_PARTY.md e a rota /sobre o nomeiam.
#
# Sem dependência de nenhum vendor-*.sh — só lê arquivos já commitados no
# git, roda em qualquer ordem/momento (ver scripts/README.md).
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0
err() {
  echo "AGPL-GATE FAIL: $1" >&2
  fail=1
}

SWIFTLATEX_DIR="public/wasm/swiftlatex"
COMPILER_README="packages/compiler/README.md"

# O gate só se aplica enquanto o pacote compiler referenciar o engine SwiftLaTeX.
if ! grep -rq "SwiftLatexDraftCompiler" packages/compiler/src 2>/dev/null; then
  echo "AGPL-GATE: pacote compiler não referencia SwiftLaTeX — nada a verificar."
  exit 0
fi

# (a) LICENSE junto aos assets vendorizados.
if [[ ! -f "$SWIFTLATEX_DIR/LICENSE" ]]; then
  err "$SWIFTLATEX_DIR/LICENSE ausente (texto AGPL-3.0 deve acompanhar os assets)"
elif ! grep -q "GNU AFFERO GENERAL PUBLIC LICENSE" "$SWIFTLATEX_DIR/LICENSE"; then
  err "$SWIFTLATEX_DIR/LICENSE não parece ser o texto da AGPL-3.0"
fi

# (b) README do pacote com licença mista + Corresponding Source.
if [[ ! -f "$COMPILER_README" ]]; then
  err "$COMPILER_README ausente"
else
  grep -q "AGPL-3.0" "$COMPILER_README" ||
    err "$COMPILER_README não menciona AGPL-3.0 (declaração de licença mista)"
  grep -qi "Corresponding Source" "$COMPILER_README" ||
    err "$COMPILER_README não aponta o Corresponding Source dos patches"
fi

# (c) Arquivos do engine modificados localmente precisam da marcação de patch.
for engine_file in "$SWIFTLATEX_DIR/PdfTeXEngine.js" "$SWIFTLATEX_DIR/swiftlatexpdftex.js"; do
  if [[ -f "$engine_file" ]]; then
    if ! grep -Eq "papyru:|Papyru patch" "$engine_file"; then
      err "$engine_file sem marcação 'papyru:'/'Papyru patch:' — patch local não rastreável"
    fi
  fi
done

# (d) Núcleo do caminho PDF→projeto: vendorado e ligado ao mupdf.js (AGPL).
INVERSE_PKG="packages/inverse-core"
if [[ -d "$INVERSE_PKG" ]]; then
  grep -q "AGPL-3.0" "$INVERSE_PKG/package.json" ||
    err "$INVERSE_PKG/package.json não declara AGPL-3.0"
  [[ -f "$INVERSE_PKG/manifest.json" ]] ||
    err "$INVERSE_PKG/manifest.json ausente (commit de origem do vendor)"
  grep -q "mupdf" THIRD_PARTY.md ||
    err "THIRD_PARTY.md não nomeia o mupdf.js (AGPL-3.0)"
  grep -q "mupdf" src/routes/sobre.tsx ||
    err "a rota /sobre não nomeia o mupdf.js (AGPL-3.0)"
  if grep -REq '^\s*import[^;]*from\s+"node:' "$INVERSE_PKG/src" 2>/dev/null; then
    err "$INVERSE_PKG/src importa node:* — o núcleo vendorado precisa ser puro"
  fi
fi

if [[ $fail -ne 0 ]]; then
  echo "AGPL-GATE: reprovado — ver mensagens acima." >&2
  exit 1
fi
echo "AGPL-GATE: ok — engine AGPL acompanhado de LICENSE, README de licença mista e patches marcados."
