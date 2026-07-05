#!/usr/bin/env bash
# Gate de compliance AGPL (package_extraction.md §4, Fase 3 item 4).
#
# Objetivo: NÃO impedir o engine SwiftLaTeX (AGPL-3.0) de existir — impedir
# que ele exista *silenciosamente*. Falha quando o engine aparece sem o
# acompanhamento obrigatório:
#   (a) LICENSE (AGPL-3.0) publicado junto aos assets vendorizados;
#   (b) README do pacote compiler declarando a licença mista + link para o
#       Corresponding Source dos patches;
#   (c) todo arquivo de engine alterado localmente carrega a marcação
#       `papyru:` / `Papyru patch:` (rastreabilidade dos patches).
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

if [[ $fail -ne 0 ]]; then
  echo "AGPL-GATE: reprovado — ver mensagens acima." >&2
  exit 1
fi
echo "AGPL-GATE: ok — engine AGPL acompanhado de LICENSE, README de licença mista e patches marcados."
