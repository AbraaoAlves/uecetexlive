# Rascunho versus Completa

> **Para quem é:** qualquer pessoa que vai clicar em **Gerar PDF**.
> **Você vai concluir:** saber qual modo escolher e o que cada um resolve.

**Antes de começar:** nada.

## Passos

1. No topo do app, escolha o modo antes de clicar em **Gerar PDF**:
   - **Rascunho** — rápido (cerca de 3 segundos), mas não resolve citações,
     glossário nem índice. Citações aparecem como `[?]`.
   - **Completa** — resolve bibliografia, glossário **e** índice. Mais lenta
     (cerca de 1 a 4 minutos) porque roda pdfTeX + BibTeX + makeindex (duas
     vezes). Na primeira vez, baixa o motor em segundo plano
     (~150 MB comprimidos).
2. Use **Rascunho** enquanto ainda está escrevendo e só quer ver o layout.
3. Use **Completa** quando precisar conferir citações, glossário, índice, ou
   antes de considerar o trabalho pronto para entrega.
4. Se o seu projeto usa **Biber** (em vez de BibTeX) para a bibliografia, o
   modo Completa sozinho não resolve isso — veja a nota abaixo.

## Nota sobre Biber

O UeceTexLive não roda Biber nativamente no navegador. Se seu fluxo de
bibliografia depende de Biber, rode-o **uma vez, fora do app**, gerando um
`.bbl`, e use **Importar .bbl** — o build Completa então pula a etapa de
BibTeX e usa sua bibliografia pré-compilada.

## Resultado esperado

Você escolhe o modo certo para cada etapa do trabalho, e entende por que um
PDF do modo Rascunho pode mostrar `[?]` onde deveria haver uma citação.

## Se algo der errado

- **Citações continuam `[?]` mesmo no modo Completa.** Confira se as
  referências foram realmente adicionadas ao projeto e se a citação usa uma
  chave existente; se seu fluxo é Biber, veja a nota acima sobre
  **Importar .bbl**.
- **O modo Completa está demorando muito na primeira vez.** Normal — é o
  download único do motor (~150 MB comprimidos). Compilações seguintes não
  baixam de novo.

## Próximo passo

[Limitações conhecidas](Limitacoes-conhecidas).

---

*Verificado com UeceTexLive (branch `main`, sem release publicada) e modelo
uecetex2 `4c4ab76` em 2026-07-18. Fontes: `e2e/draft-mode.spec.ts`,
`e2e/compile-full.spec.ts`, `src/lib/strings.ts` (`engine.draftHint`,
`engine.fullHint`, `topbar.importBbl`), `DEVIATIONS.md` D12.*
*Encontrou um erro nesta página? [Abra uma issue](https://github.com/AbraaoAlves/uecetexlive/issues/new?template=documentacao.yml).*
