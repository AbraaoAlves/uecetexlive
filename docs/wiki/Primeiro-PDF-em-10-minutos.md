# Primeiro PDF em 10 minutos

> **Para quem é:** quem nunca usou o UeceTexLive (ou nunca usou LaTeX).
> **Você vai concluir:** editar um trecho do trabalho, gerar um PDF e
> exportar uma cópia de segurança.

**Antes de começar:** nada — basta abrir o app em um navegador atualizado
(Chrome/Chromium recomendado; outros navegadores não são testados, ver
[Limitações conhecidas](Limitacoes-conhecidas)).

## Passos

1. Abra o UeceTexLive. Na primeira visita aparece uma caixa de boas-vindas.
   Clique em **Preencher dados** para abrir o **Guia do trabalho** em tela
   cheia (ou **Depois** para começar direto no editor — dá para reabrir o
   guia pelo **Menu**, em “Guia do trabalho…”).
2. O guia percorre título, tipo, autor, orientação, data, banca, resumo e
   abstract; depois oferece os **elementos opcionais** (o que entra ou não
   no PDF), os **anexos** (ficha catalográfica, folha de aprovação assinada,
   imagens, PDFs e arquivos de código) e uma **revisão final**, que lista o
   que ainda falta e tem um botão para gerar o PDF. Os dados são salvos
   sozinhos, campo a campo.
3. No painel de arquivos à esquerda, escolha um capítulo e edite um trecho
   do texto no editor visual.
4. Clique em **Gerar PDF** (atalho `Ctrl+Enter` no Windows/Linux ou
   `Cmd+Enter` no Mac). Por padrão o modo é **Rascunho** — rápido, mas não
   resolve citações (ver [Rascunho versus Completa](Rascunho-vs-Completa)).
5. Confira o resultado no painel de pré-visualização, aba **PDF**. Se algo
   der errado, a aba **Detalhes** mostra o que aconteceu.
6. Páginas opcionais (Agradecimentos, Dedicatória, Epígrafe, Errata,
   Glossário, listas de siglas e de símbolos) têm uma caixinha ao lado do
   nome, no painel de arquivos — as mesmas do passo “Elementos opcionais”
   do guia. Desmarque para tirar a página do PDF e marque para incluir de
   novo — o arquivo continua no projeto, com o texto intacto.
7. Abra o menu (**Menu**) e clique em **Exportar projeto (.zip)** para baixar
   uma cópia de segurança do seu trabalho.

## Resultado esperado

Um PDF visível no painel de pré-visualização com o texto que você editou, e
um arquivo `.zip` baixado com todo o projeto.

## Se algo der errado

- **A caixa de boas-vindas não aparece de novo depois que fechei.** Esperado
  — ela só aparece uma vez por navegador/dispositivo.
- **O PDF não atualiza depois de editar.** Clique em **Gerar PDF** de novo —
  o app não compila automaticamente a cada tecla.
- **Desmarquei a caixinha e a página continua no PDF.** Clique em **Gerar
  PDF** de novo — a mudança só aparece na próxima geração.
- **Citações aparecem como `[?]`.** Normal no modo **Rascunho**; troque para
  **Completa** para resolver bibliografia, glossário e índice (ver
  [Rascunho versus Completa](Rascunho-vs-Completa)).
- Outros sintomas: [Onde pedir ajuda](Onde-pedir-ajuda).

## Próximo passo

[Antes de começar: privacidade, espaço e backups](Antes-de-comecar) — leia
antes de escrever o trabalho de verdade.

---

*Verificado com UeceTexLive (branch `main`, sem release publicada) e modelo
uecetex2 `4c4ab76` em 2026-08-01. Fontes: `e2e/metadata.spec.ts`,
`e2e/draft-mode.spec.ts`, `e2e/import-export.spec.ts`,
`e2e/imprimir-toggles.spec.ts`, `e2e/wizard-fullscreen.spec.ts`,
`src/lib/strings.ts`.*
*Encontrou um erro nesta página? [Abra uma issue](https://github.com/AbraaoAlves/uecetexlive/issues/new?template=documentacao.yml).*
