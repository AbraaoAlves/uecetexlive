# UeceTexLive

> Edite e compile sua monografia UECE (abnTeX2) **inteiramente no navegador**.
> Seu texto nunca sai do seu computador.

Iniciativa extraoficial, sem vínculo institucional com a UECE.

**[Abrir o UeceTexLive](https://abraaoalves.me/uecetexlive/)** ·
[Começar pela Wiki](docs/wiki/Home.md) ·
[Pedir ajuda](SUPPORT.md) ·
[Contribuir](CONTRIBUTING.md)

> A Wiki pública ainda depende de uma ação humana (F0.2/F1.11); até lá, a
> fonte em [`docs/wiki/`](docs/wiki/) já pode ser lida diretamente no
> repositório.

## Para quem é

- **Estudante da UECE sem experiência em LaTeX** — abra o app, preencha os
  dados do trabalho, edite no modo visual e gere o PDF sem instalar nada.
- **Estudante ou docente que já usa o uecetex2** — o modelo já vem carregado,
  com a mesma estrutura de capítulos, glossário, índice e bibliografia.
- **Pessoa de abnTeX2/LaTeX** — consulte a matriz de compatibilidade (Wiki)
  antes de assumir que um projeto abnTeX2 qualquer funciona sem ajuste.
- **Pessoa desenvolvedora** — veja [`CONTRIBUTING.md`](CONTRIBUTING.md) para
  preparar o ambiente e entender o monorepo.

## Primeiros passos

1. Abra o app na URL acima.
2. Edite um trecho no editor visual (ou alterne para o modo LaTeX com
   `Mod+E`).
3. Clique em **Gerar PDF** (`Mod+Enter`) e confira o resultado no painel de
   pré-visualização.
4. Exporte o projeto como `.zip` — é o seu backup, já que tudo fica salvo
   apenas no navegador.

Tem um documento que usa Biber? Rode o Biber uma vez fora do app e use
**Importar .bbl** — o build Completa pula o BibTeX e usa sua bibliografia
pré-compilada.

## Privacidade e offline

"Tudo acontece no seu navegador: seu texto nunca sai do seu computador." Não
há backend, contas nem compilação em servidor. O motor Completa baixa uma vez
em segundo plano logo após o boot (~150 MB comprimidos na rede, ~220 MB em
cache — ver `DEVIATIONS.md` D12); depois disso o app funciona **offline**.

Como o armazenamento é só o navegador (IndexedDB), **exportar o `.zip` de
backup com frequência é responsabilidade sua** — limpar dados do navegador
apaga o projeto.

**Nota sobre telemetria:** entre 11 e 13 de julho de 2026 esta aplicação
coletou, para um Trabalho de Conclusão de Curso, eventos anônimos de uso
(por exemplo "gerar PDF", "exportar") — nunca o conteúdo do documento,
autocapture ou gravação de sessão. A janela de coleta terminou e o código
de telemetria foi **removido** do projeto em 19/07/2026; não há mais
nenhuma coleta de uso.

## Dois motores de compilação, um botão

| Modo | Motor | Velocidade | Resolve |
| --- | --- | --- | --- |
| **Rascunho** | SwiftLaTeX pdfTeX (TL 2020) | ~3 s | só layout — citações aparecem `[?]` |
| **Completa** | busytex: pdfTeX + bibtex8 + makeindex ×2 | ~1–4 min (após o download único de ~150 MB comprimidos) | bibliografia, glossário **e** índice |

## Relação com o uecetex2 e o abnTeX2

O UeceTexLive carrega um snapshot fixo do modelo **uecetex2**
(commit `4c4ab76`, fork `abraaoalves/uecetex2`, derivado do upstream
`thiagodnf/uecetex2`), que por sua vez é baseado na classe **abnTeX2**
(observada na versão 1.9.7 no momento do vendoring, **não fixada** — o motor
Completa injeta a versão corrente do CTAN). Isso significa: o que o
UeceTexLive testa e resolve é o comportamento desse snapshot, não uma
promessa de compatibilidade com qualquer projeto abnTeX2. Detalhes em
[`THIRD_PARTY.md`](THIRD_PARTY.md) e na rota `/sobre` do app.

## Limites conhecidos

- Biber nativo não é suportado no navegador — só via **Importar .bbl**
  pré-compilado.
- Os testes automatizados (E2E) rodam apenas em Chromium; suporte a outros
  navegadores não é testado.
- abnTeX2 não é fixado em versão — pode divergir silenciosamente do CTAN.
- Acessibilidade do aplicativo (teclado, leitor de tela) é uma dívida de
  produto conhecida e registrada, não uma auditoria já feita.
- O motor Completa exige ~150 MB de download na primeira visita.

Lista completa e evidências: [`Limitacoes-conhecidas.md`](docs/wiki/Limitacoes-conhecidas.md).

## Comunidade

[Wiki](docs/wiki/Home.md) (manual de uso) ·
[`CONTRIBUTING.md`](CONTRIBUTING.md) ·
[`SUPPORT.md`](SUPPORT.md) ·
[`SECURITY.md`](SECURITY.md) ·
[Código de Conduta](CODE_OF_CONDUCT.md)

## Desenvolvimento (resumo)

```bash
bun install
./scripts/vendor-uecetex2.sh        # modelo (commit fixado)
./scripts/vendor-busytex.sh         # motor Completa (~216 MB)
./scripts/sync-texlive-cache.sh     # motor Rascunho TL2020 (~85 MB)
bun run dev                         # http://localhost:5173
```

Ambiente completo, convenções, testes e processo de PR:
[`CONTRIBUTING.md`](CONTRIBUTING.md).

### Mapa de arquitetura

| Área | Onde | Notas |
| --- | --- | --- |
| Motores de compilação | `packages/compiler/` | interface `PdfCompiler`; busytex + SwiftLaTeX por trás dela |
| Orquestração de passes | `packages/compiler/src/orchestrator.ts` | fixpoint latexmk-em-TS (puro, TDD) |
| Worker do busytex | `public/wasm/busytex/uecetexlive.worker.js` | ver [`docs/busytex-integration.md`](docs/busytex-integration.md) |
| Pipeline do SwiftLaTeX | [`docs/prototype-compile-pipeline.md`](docs/prototype-compile-pipeline.md) | contrato de URLs do TeX Live + 3 patches do motor |
| Service worker | `src/sw.ts` | precache do app-shell + descompressão gzip do payload do busytex no Pages (D12) |
| LaTeX ⇄ ProseMirror | `packages/latex-mapping/` | invariantes de byte-identidade e estabilidade (puro, TDD) |
| Editor WYSIWYG | `packages/editor/` | suíte de extensões Tiptap, node views, menus slash/bubble |
| Modelo de projeto | `packages/project-model/` (adapters em `src/features/project/`) | schema Zod, grafo de includes, zip, reordenação (puro, TDD) |
| Persistência | `src/features/persistence/db.ts` | IndexedDB (`uecetexlive`) |
| Shell / preview | `src/features/{shell,preview}/` | UI de três painéis, PDF (pdf.js) + painel Detalhes |
| Pesquisa sobre Biber | [`docs/research/biber-wasm.md`](docs/research/biber-wasm.md) | avaliação dos tiers 2–3 |

A especificação histórica completa é [`INITIAL_PLAN.md`](INITIAL_PLAN.md); os
desvios dela (a realidade conquistada na prática) estão em
[`DEVIATIONS.md`](DEVIATIONS.md). As decisões de arquitetura registradas
estão em [`docs/decisions.md`](docs/decisions.md).

## Licenças

MIT (ver [`LICENSE`](LICENSE)). Componentes de terceiros — com destaque para
o motor SwiftLaTeX (AGPL-3.0, servido com patches documentados) e os pacotes
agregados do busytex/TeX Live — mantêm suas próprias licenças; ver
[`THIRD_PARTY.md`](THIRD_PARTY.md).
