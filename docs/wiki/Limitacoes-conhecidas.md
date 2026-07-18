# Limitações conhecidas

> **Para quem é:** qualquer pessoa avaliando se o UeceTexLive atende ao seu
> caso antes de investir tempo nele.
> **Você vai concluir:** saber o que o app não faz hoje, com evidência, para
> não descobrir isso no meio do trabalho.

**Antes de começar:** nada.

## Passos

Leia a lista abaixo antes de depender do UeceTexLive para uma entrega com
prazo apertado.

1. **Biber não é suportado nativamente.** Só é possível usar bibliografia
   gerada por Biber importando um `.bbl` pré-compilado externamente (menu
   **Importar .bbl**); o motor Completa em si roda BibTeX (`bibtex8`), não
   Biber. Pesquisa aberta sobre Biber no navegador:
   [`docs/research/biber-wasm.md`](https://github.com/AbraaoAlves/uecetexlive/blob/main/docs/research/biber-wasm.md).
2. **Só Chromium é testado automaticamente.** Os testes end-to-end do CI
   rodam apenas no projeto `ui` do Playwright, em Chromium. Firefox, Safari e
   navegadores móveis **não têm evidência de suporte testado** — podem
   funcionar, mas isso não foi verificado.
3. **Acessibilidade do aplicativo é uma dívida de produto registrada, não
   uma auditoria concluída.** Navegação por teclado e compatibilidade com
   leitor de tela não foram auditadas — ver SKIP 3.6 em
   [`docs/decisions.md`](https://github.com/AbraaoAlves/uecetexlive/blob/main/docs/decisions.md).
   Isto é diferente da acessibilidade *desta documentação*, que segue regras
   editoriais próprias.
4. **abnTeX2 não é fixado em versão.** O motor Completa injeta a versão
   corrente do CTAN no momento do vendoring (observada como 1.9.7); não há
   pin como existe para o modelo uecetex2. Isso significa que builds futuros
   podem divergir silenciosamente se o CTAN atualizar o pacote.
5. **Importação de `.docx` ou texto colado formatado não é suportada** —
   decisão de escopo registrada como SKIP 3.3 em `docs/decisions.md`, não
   uma limitação técnica temporária.
6. **O motor Completa exige ~150 MB de download comprimido** (~220 MB em
   cache) na primeira visita antes de funcionar offline — importante para
   quem está em conexão limitada.
7. **Compatibilidade com projetos abnTeX2 além do uecetex2 não é testada.**
   O UeceTexLive testa e resolve o snapshot do uecetex2 que ele carrega, não
   qualquer customização institucional de abnTeX2.

## Resultado esperado

Você sabe, com evidência, o que esperar do app antes de depender dele para
uma entrega.

## Se algo der errado

- **Preciso de Biber e não tenho como gerar o `.bbl` externamente.** Por ora,
  isso é um limite real do projeto — considere compilar localmente com uma
  instalação LaTeX completa para esse caso específico.
- **Uso um navegador diferente de Chromium e algo não funciona.** Não é uma
  regressão conhecida (não há teste automatizado ali), mas relate mesmo
  assim com a label certa — ajuda a mapear o que realmente funciona.

## Próximo passo

[Onde pedir ajuda](Onde-pedir-ajuda), se algo daqui te bloqueou.

---

*Verificado com UeceTexLive (branch `main`, sem release publicada) e modelo
uecetex2 `4c4ab76` em 2026-07-18. Fontes: `playwright.config.ts` (projeto
`ui` = Chromium), `docs/decisions.md` (SKIP 3.3, SKIP 3.6),
`docs/research/biber-wasm.md`, `scripts/vendor-busytex.sh`,
`DEVIATIONS.md` D12.*
*Encontrou um erro nesta página? [Abra uma issue](https://github.com/AbraaoAlves/uecetexlive/issues/new?template=documentacao.yml).*
