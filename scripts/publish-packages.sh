#!/usr/bin/env bash
# Publica @papyru/{latex-mapping,project-model,compiler,editor,bibliography}
# no npm, na ordem de dependência (package_extraction.md, Fase 4 — runbook
# do primeiro publish). editor depende dos outros via workspace:*; os
# demais (incl. bibliography, UI_UX_PLAN §5.5) não dependem entre si.
#
# O que este script de propósito NÃO faz: não edita "version" nem "exports"
# em packages/*/package.json. Bump de versão e a troca de exports de src/
# para dist/ são decisão de release tomada por um humano antes de rodar
# este script — ver o tutorial de configuração inicial. O script só valida
# que isso já foi feito, builda, roda os gates e publica.
#
# Uso:
#   scripts/publish-packages.sh              publica de verdade (pede confirmação)
#   scripts/publish-packages.sh --dry-run    empacota e valida, não publica
#   scripts/publish-packages.sh --yes        pula a confirmação interativa
set -euo pipefail
cd "$(dirname "$0")/.."

DRY_RUN=0
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --yes | -y) ASSUME_YES=1 ;;
    -h | --help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "argumento desconhecido: $arg (use --dry-run, --yes ou --help)" >&2
      exit 1
      ;;
  esac
done

# Ordem de dependência — package_extraction.md §"Os 4 pacotes" + bibliography (UI_UX_PLAN §5.5).
PACKAGES=(latex-mapping project-model compiler editor bibliography)

read_json_field() {
  bun -e '
    const fs = require("fs");
    const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const path = process.argv[2].split(".");
    let v = pkg;
    for (const key of path) v = v?.[key];
    console.log(v === undefined ? "" : JSON.stringify(v));
  ' "$1" "$2"
}

echo "==> Validando que cada pacote está pronto para publish (não em modo workspace-dev)"
for pkg in "${PACKAGES[@]}"; do
  dir="packages/$pkg"
  problems=$(bun -e '
    const fs = require("fs");
    const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const problems = [];
    if (pkg.version === "0.0.0") {
      problems.push("version ainda é 0.0.0 (placeholder) — defina uma versão real antes do publish");
    }
    if (JSON.stringify(pkg.exports ?? {}).includes("/src/")) {
      problems.push("exports ainda aponta para src/ — troque para dist/ e rode o build antes do publish");
    }
    console.log(problems.join("\n"));
  ' "$dir/package.json")
  if [[ -n "$problems" ]]; then
    echo "  x $dir/package.json:" >&2
    echo "$problems" | sed 's/^/      - /' >&2
    echo >&2
    echo "Corrija manualmente (version + exports) antes de rodar este script — ver o runbook em package_extraction.md, Fase 4, item 1." >&2
    exit 1
  fi
  version=$(read_json_field "$dir/package.json" version | tr -d '"')
  echo "  ok @papyru/$pkg@$version"
done

echo "==> Build + check (biome, tsc, vitest, gate AGPL)"
bun run --filter './packages/*' build
bun run check
scripts/check-agpl-compliance.sh

if [[ $ASSUME_YES -ne 1 && $DRY_RUN -ne 1 ]]; then
  echo
  echo "Prestes a publicar no npm (irreversível — versão publicada não pode ser removida, só depreciada):"
  for pkg in "${PACKAGES[@]}"; do
    version=$(read_json_field "packages/$pkg/package.json" version | tr -d '"')
    echo "  - @papyru/$pkg@$version"
  done
  read -r -p "Confirmar publish? [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || { echo "Abortado."; exit 1; }
fi

for pkg in "${PACKAGES[@]}"; do
  name="@papyru/$pkg"
  version=$(read_json_field "packages/$pkg/package.json" version | tr -d '"')

  if [[ $DRY_RUN -ne 1 ]] && npm view "$name@$version" version >/dev/null 2>&1; then
    echo "==> $name@$version já está no registry — pulando"
    continue
  fi

  echo "==> Publicando $name@$version"
  (
    cd "packages/$pkg"
    if [[ $DRY_RUN -eq 1 ]]; then
      bun publish --access public --dry-run
    else
      bun publish --access public
    fi
  )
done

echo
echo "==> Concluído. Próximo passo manual (dogfooding real — package_extraction.md, Fase 4, item 4):"
echo "    trocar 'workspace:*' por '^<versão>' nas dependências @papyru/* em"
echo "    package.json (raiz) e packages/editor/package.json, rodar 'bun install'"
echo "    e 'bun run check' + e2e para confirmar que o app roda 100% sobre o que"
echo "    está publicado no registry, não sobre o workspace local."
