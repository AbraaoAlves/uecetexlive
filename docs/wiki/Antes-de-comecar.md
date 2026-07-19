# Antes de começar: privacidade, espaço e backups

> **Para quem é:** qualquer pessoa antes de escrever o trabalho de verdade
> no UeceTexLive.
> **Você vai concluir:** entender onde seus dados ficam salvos, os limites
> disso e o hábito de backup que evita perda de trabalho.

**Antes de começar:** nada — mas vale ler isto antes de escrever várias
páginas, não depois de perdê-las.

## Passos

1. **Entenda onde seu trabalho vive.** Tudo acontece no seu navegador: seu
   texto nunca sai do seu computador. Não há servidor, não há conta — o que
   é ótimo para privacidade, mas quer dizer que **limpar os dados do site
   (ou trocar de computador) apaga tudo**.
2. **Saiba o que baixa na primeira visita.** O modo Completa baixa um motor
   de compilação (~150 MB comprimidos na rede, ~220 MB em cache) uma vez em
   segundo plano. Depois disso, o app funciona **offline**.
3. **Adote o hábito de exportar.** Pelo menu (**Menu**), clique em
   **Exportar projeto (.zip)** regularmente. O UeceTexLive também mostra um
   lembrete de backup de vez em quando — não ignore.

Nota histórica: entre 11 e 13 de julho de 2026 esta aplicação coletou, para
um Trabalho de Conclusão de Curso, eventos anônimos de uso (ex.:
"gerar PDF", "exportar") — nunca o conteúdo do documento. A janela terminou
e o código de coleta foi removido do projeto em 19/07/2026.

## Resultado esperado

Você sabe que o navegador é o único lugar onde o projeto existe, sabe o
tamanho do download inicial do modo Completa, e tem o hábito de exportar
`.zip` regularmente.

## Se algo der errado

- **Limpei os dados do navegador (ou troquei de computador) e perdi tudo.**
  Sem backup exportado, não há como recuperar — o armazenamento é local ao
  navegador (IndexedDB). Restaure a partir do último `.zip` exportado, se
  houver.
- **O primeiro carregamento está lento.** Esperado na primeira visita com o
  modo Completa — é o download único do motor.

## Próximo passo

[Rascunho versus Completa](Rascunho-vs-Completa).

---

*Verificado com UeceTexLive (branch `main`, sem release publicada) em
2026-07-19. Fontes: `src/lib/strings.ts` (`strings.sobre.backupBody`),
`DEVIATIONS.md` D12.*
*Encontrou um erro nesta página? [Abra uma issue](https://github.com/AbraaoAlves/uecetexlive/issues/new?template=documentacao.yml).*
