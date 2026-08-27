# Como contribuir

Obrigado por considerar contribuir com o UeceTexLive. Este documento cobre
como contribuir com ou sem escrever código, como preparar o ambiente, os
checks de qualidade e as convenções do repositório.

## 1. Formas de contribuir sem escrever código

- **Compartilhar uma ideia ou experiência de uso.** Abra uma conversa na
  categoria [Ideas das Discussions](https://github.com/AbraaoAlves/uecetexlive/discussions/categories/ideas).
  Quando a proposta estiver clara e pronta para implementação, ela poderá ser
  transformada em uma issue rastreável.
- **Relatar um bug.** Abra uma issue com o template "Relatar um problema" —
  inclua passos de reprodução e o modo de compilação (Rascunho/Completa).
- **Melhorar a documentação.** README, Wiki (`docs/wiki/`) e `docs/` são
  Markdown normal, revisados por PR como qualquer código. Erros de texto,
  links quebrados ou passos desatualizados podem ser corrigidos direto.
- **Testar jornadas de uso.** Siga um tutorial da Wiki do começo ao fim e
  relate onde travou — mesmo sem saber programar, isso é uma contribuição de
  alto valor.
- **Revisar afirmações sobre ABNT/abnTeX2/uecetex2.** Se você conhece as
  normas ou a classe abnTeX2, revisar a matriz de compatibilidade e a página
  de camadas da Wiki evita que o projeto prometa mais do que testa.

## 2. Preparar o ambiente do zero

Pré-requisito: [bun](https://bun.sh) instalado.

```bash
bun install
```

Os três scripts de vendor baixam artefatos grandes e não versionados (só os
manifests pequenos ficam no git). Rode todos antes de `bun run dev`:

```bash
./scripts/vendor-uecetex2.sh        # snapshot do modelo (commit fixado), rápido
./scripts/vendor-busytex.sh         # motor Completa: ~216 MB, pode levar minutos
./scripts/sync-texlive-cache.sh     # motor Rascunho (TL2020): ~85 MB
```

```bash
bun run dev                         # http://localhost:5173
```

Os scripts são idempotentes — rodar de novo não duplica nem corrompe o
cache local.

## 3. Qualidade

```bash
bun run check     # gate de CI: biome check . && tsc --noEmit && vitest run && bun run --filter './packages/*' check
bun run e2e        # Playwright — --project=ui (rápido) ou --project=full-compile (lento, compila de verdade)
bun run storybook  # galeria de componentes
```

`bun run check` precisa passar antes de qualquer PR. `bun run e2e` exige os
assets vendorados (passo 2) e, para `--project=full-compile`, um build atual.

## 4. Convenções

- **Formatação e lint:** [Biome](https://biomejs.dev) (não ESLint/Prettier).
  `lefthook.yml` roda `biome check` automaticamente no pre-commit dos
  arquivos staged.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/),
  como no histórico do repositório: `feat(escopo): ...`, `fix(escopo): ...`,
  `docs: ...`, `docs(wiki): ...`, `test(e2e): ...`, `ci: ...`. Um assunto por
  commit.
- **Gerenciador de pacotes:** `bun`, não `npm`/`yarn` — não commitar
  `package-lock.json` nem `yarn.lock`.

## 5. Processo de PR

1. Abra o PR com o template padrão (`.github/pull_request_template.md`), que
   pede o que mudou, como foi verificado e se a documentação foi afetada.
2. `bun run check` roda no CI (`ci.yml`); PRs que tocam caminhos relevantes
   também disparam o `e2e-full.yml`.
3. Marque a checkbox "documentação afetada?" sempre que o comportamento
   visível mudar — README, Wiki ou `docs/` podem precisar de atualização no
   mesmo PR.

## 6. Estrutura do monorepo

Não existe `apps/`; o app principal vive em `src/`. Pacotes extraídos em
`packages/` (todos na versão `0.0.0`):

| Pacote | Propósito |
| --- | --- |
| `@papyru/bibliography` | parser/serializador BibTeX próprio, chaves de citação |
| `@papyru/compiler` | interface `PdfCompiler`; motores busytex e SwiftLaTeX; orquestrador latexmk-em-TS |
| `@papyru/editor` | editor WYSIWYG Tiptap + modo fonte CodeMirror |
| `@papyru/latex-mapping` | LaTeX ⇄ ProseMirror com invariantes de byte-identidade |
| `@papyru/project-model` | schema Zod, grafo de includes, zip, persistência |

Decisões de arquitetura (ADRs) e escopo explicitamente fora do produto (ex.:
import de `.docx`, acessibilidade como dívida registrada) estão em
[`docs/decisions.md`](docs/decisions.md).
