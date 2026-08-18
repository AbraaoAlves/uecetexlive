# Decisões de arquitetura e produto (ADRs)

Registro das decisões de arquitetura e produto do UeceTexLive, com o
contexto que levou a cada uma. Os números `ADR-0x` citados em comentários no
código resolvem aqui. Todas passaram por rodada de alinhamento com o
responsável pelo produto antes de virarem código.

## ADR-01 — Parser BibTeX próprio (chunk model)

**Contexto.** O editor CRUD de referências precisa ler e reescrever o `.bib`
do aluno sem destruir o que não entende (comentários, entries exóticas,
espaçamento).

**Decisão.** Parser/serializer próprio com chunk model — regiões não
reconhecidas são preservadas byte a byte — espelhando a abordagem de
`packages/latex-mapping`. Não usar `bibtex-tidy` nem
`@retorquere/bibtex-parser` para escrita (este último permanece apenas no
caminho display-only do picker de busca).

**Consequências.** Round-trip seguro para qualquer `.bib`; em troca, o
parser cobre só o subconjunto que o form edita
(`packages/bibliography/src/domain/bib-file.ts`).

## ADR-02 — Sem biblioteca de estado

**Decisão.** Sem Zustand (ou similar): `bibText` vive no `ProjectContext`
já existente e os comandos de escrita do `.bib` são funções puras, testadas
fora do React (`packages/bibliography/src/domain/commands.ts`).

**Consequências.** Zero dependência nova; a lógica de domínio testa sem DOM;
o React só orquestra.

## ADR-03 — Painel Referências como aba do rail

> **Superseded by [ADR-08](#adr-08--referências-como-modo-de-visualização-do-bib).**
> A aba resolvia "onde colocar a UI de referências" quando o rail era o único
> espaço livre. Ela não escalava: um formulário de referência em 384px é
> apertado, e a vaga rendia mais para a conformidade.

**Decisão.** A UI de referências é uma aba (Arquivos / Referências) dentro
do rail lateral existente, não um painel ou rota separada. A aba ativa
persiste em `UiSettings.railTab` (`packages/project-model/src/schema.ts`).

## ADR-04 — Campos ABNT de URL/acesso

**Decisão.** Confirmado direto no `abntex2-alf.bst` vendorado (`ENTRY` e
`format.url`): os campos são literalmente `url` e `urlaccessdate` — não
`note` — e `urlaccessdate` é texto livre no `.bst`, então o formulário
aceita o que o usuário digitar (ex. "10 jan. 2024"), sem
`<input type="date">` (`packages/bibliography/src/domain/entry-schema.ts`).

## ADR-05 — Nova entry sempre no final do arquivo

**Decisão.** `addEntry` insere no fim do `.bib` — a única forma de ser
não-destrutivo sem depender do chunk model completo. Consequência direta do
ADR-01: append puro não exige o parse geral 100% resolvido.

## ADR-06 — Superfície pública de `@papyru/bibliography`

**Decisão.** Barrel único (`"exports": {".": "./src/index.ts"}`), como
`latex-mapping`/`project-model` — os outros pacotes puros de domínio do
monorepo. Subpaths (`./domain`, `./search`) podem ser adicionados depois de
forma aditiva, sem quebrar consumidores.

**Consequências (a parte permanente).** O pacote é publicado e compartilhado
com o produto comercial Papyru: qualquer mudança de shape em
`ReferenceCandidate`/`BibliographyEntry` é breaking change para dois
consumidores — versionar com cuidado. E a garantia "pacote nunca fala com
API externa" não vale para `search/` (CrossRef/OpenLibrary), ainda que
continue valendo para o texto do usuário.

## ADR-07 — Largura do rail na aba Referências

> **Superseded by [ADR-08](#adr-08--referências-como-modo-de-visualização-do-bib).**
> A largura variável existia só para caber o formulário de referência na aba.
> Sem a aba, o rail volta a ter uma largura só.

**Decisão.** O `<aside>` inteiro alarga (`w-60` → `w-96`) quando
`railTab === "references"`, reusando a mesma `transition-[width]` do
collapse; a div interna de largura fixa muda junto, ou o form fica cortado
(ver comentário em `AppShell.tsx`).

## ADR-08 — Referências como modo de visualização do `.bib`

**Contexto.** A edição de referências morava numa aba do rail (ADR-03), com
largura própria (ADR-07). Duas coisas não fechavam: um formulário de
referência em 384px é apertado, e a lista ficava longe do arquivo que ela
edita — o aluno via `referencias.bib` na árvore, clicava, e caía no BibTeX
cru, sem relação visível com a aba ao lado.

Ao mesmo tempo, os `.tex` de prosa já tinham a resposta pronta: um botão na
barra do editor alterna "Fonte LaTeX" e "Editor visual" sobre o **mesmo
arquivo**.

**Decisão.** Todo arquivo `.bib` ganha modo de visualização "Referências" na
área de edição, no mesmo botão `view-toggle`, com os rótulos "Fonte BibTeX"
e "Referências". A aba Referências sai do rail; a vaga vai para a
Conformidade (ADR-09). Consequências:

- o `bibText` passa a vir do arquivo **aberto**, não do `\bibliography{}`
  descoberto pelo grafo de includes — um projeto com dois `.bib` edita cada
  um no seu lugar;
- `UiSettings.railTab` mantém `"references"` no enum e migra para `"files"`
  na leitura (`migrateUiSettings`). Tirar o valor do enum faria o
  `safeParse` falhar e devolver **todos** os defaults, apagando tema, modo
  avançado e as linhas-base do lembrete de backup junto com a aba;
- "Inserir citação no texto" sai da lista, porque sem um editor de texto
  montado ao lado não há cursor onde inserir. Quem escreve insere pelo menu
  "/" de dentro do editor visual; quem está na lista copia a citação;
- o "ver código" interno da lista sai: com o `view-toggle` abrindo o
  CodeMirror editável, um segundo modo-fonte somente leitura só confundiria.

## ADR-09 — Conformidade como aba do rail

**Contexto.** A conferência de conformidade inicialmente abria numa janela
sobre o editor. Para que uma ação de correção fosse útil, ela precisava fechar
antes de abrir o destino; assim, a pessoa perdia a lista enquanto corrigia. A
janela também não mantinha o foco dentro de si nem o devolvia ao controle de
origem quando fechada.

**Decisão.** A conformidade vive como aba permanente do painel lateral, ao
lado do texto. As ações abrem o destino no editor, nas referências ou nos
guia do trabalho sem trocar a aba; cada pendência visitada permanece visível
até que deixe de existir.

**Consequências.** A lista acompanha a correção e pode orientar o próximo
passo sem reconstruir contexto. Em contrapartida, ela precisa caber na largura
do painel: grupos longos começam recolhidos, e descrições extensas são
abreviadas visualmente com o texto completo disponível como dica.

## Decisões de escopo do produto (SKIP)

Registradas porque foram deliberadas, não esquecidas — com a condição em que
valeria reavaliar.

### SKIP 3.3 — Import de .docx / texto colado

**Decisão do responsável pelo produto: não implementar.** Dois caminhos
foram estudados: (A) colar texto + heurística de títulos → mapa de
capítulos; (B) `.docx` via `mammoth.js` client-side (preserva a promessa de
privacidade) → HTML → mesma conversão. Nenhum prometia conversão fiel de
tabelas/imagens na v1.

**Reavaliar se** a validação mostrar que os alunos chegam majoritariamente
com o trabalho já começado no Word.

### SKIP 3.6 — Acessibilidade (teclado, leitor de tela, contraste)

**Decisão do product owner: não implementar** a auditoria completa (axe,
navegação por teclado de ponta a ponta, contraste AA,
`prefers-reduced-motion`, leitor de tela no fluxo principal). Partes da UI
nasceram com semântica razoável (tabela de referências, labels, foco
gerenciado), mas o produto não passou por auditoria e há achados conhecidos
(ex.: tooltips do rail inalcançáveis por teclado).

**Reavaliar se** o produto seguir além do estudo do TCC — para um projeto
cujo objetivo é democratizar acesso, esta é a primeira dívida a pagar.
