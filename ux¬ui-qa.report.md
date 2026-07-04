# QA Visual/UX — UeceTexLive (runtime, http://localhost:5173)

**Data:** 2026-07-04
**Metodologia:** teste manual guiado por browser automatizado (gstack browse), como usuário real — cliques, digitação, upload de arquivos, troca de tema, redimensionamento de viewport. Sem leitura de código-fonte; todos os achados abaixo foram observados e reproduzidos no app rodando.
**Escopo:** modo simples/avançado, editor visual (Tiptap) e editor de fonte (CodeMirror), preview de PDF, wizard "Dados do Trabalho", upload de arquivos, toolbar, find & replace, tabelas, citações, tema escuro, responsividade.
**Screenshots:** `.gstack/qa-reports/screenshots/` (referenciadas por nome ao longo do relatório).

## Placar geral

| Severidade | Qtde |
|---|---|
| Crítico | 2 |
| Alto | 5 |
| Médio | 5 |
| Baixo / polimento | 2 |

Os 5 pontos que você já havia identificado foram **todos confirmados** com evidência em tela e, em alguns casos, com a causa técnica exata (não só o sintoma). Além deles, encontrei 8 problemas novos, incluindo um de **corrupção silenciosa de conteúdo** (tabela inserida via toolbar) e a **ausência total de responsividade** (o app quebra por completo abaixo de ~1024px).

## Status das correções (2026-07-04, mesma sessão)

Todos os itens abaixo foram corrigidos e verificados no browser, exceto **C2 (responsividade)**, adiado por decisão de escopo para uma onda dedicada.

| Item | Status | Correção |
|---|---|---|
| C1 tabela corrompe documento | ✅ corrigido | Toolbar/slash inserem nó `latexTable` com grade visual editável (a grade já existia; o comando inseria `rawLatexBlock`) |
| C2 responsividade zero | ⏸ adiado | Onda dedicada futura, por decisão de escopo |
| A1 PDF não reage ao tema | ✅ corrigido | Inversão de cores segue o tema automaticamente (MutationObserver) + página escala fit-width no painel |
| A2 F&R só no modo fonte | ✅ corrigido | Painel de Localizar/Substituir no editor visual (plugin ProseMirror, highlights, Ctrl+F, botão na toolbar) |
| A3 wizard ocupa o editor | ✅ corrigido | Wizard agora é modal flutuante (backdrop, Escape, clique-fora) |
| A4 upload PDF/código inexistente | ✅ corrigido | Botão de upload na seção FIGURAS (imagem/PDF/código → `figuras/`); picker de figura aceita PDF |
| A5 cabeçalhos desalinhados 4px | ✅ corrigido | Linha de contagem de palavras h-8 → h-9, igual às abas do preview |
| M1 prompt nativo p/ capítulo | ✅ corrigido | Dialog do app com validação (vazio desabilita criar), Enter/Escape |
| M2 LaTeX malformado (\end{figure}\chapter) | ✅ corrigido | Serializador coage `gapBefore` vazio obsoleto para linha em branco; round-trip preservado pelo backstop do parser |
| M3 rótulo "Tabela" no picker de citação | ✅ corrigido | Era o nó de tabela atrás do overlay translúcido; picker ganhou título próprio por tipo + backdrop mais opaco |
| M4 menus não se fecham | ✅ corrigido | Clique-fora e Escape fecham o menu do topo |
| M5 PDF do projeto abre painel em branco | ✅ corrigido | Preview via pdf.js (PdfPane reutilizado: zoom, inversão, contador de páginas) em vez de iframe |
| B1 F&R sem contador | ✅ corrigido | Contador "n de m" nos dois modos (painel compartilhado; CodeMirror ganhou painel custom) |
| B2 "arquivos ocultos" não acionável | ✅ corrigido | Link "mostrar" ativa o modo Avançado direto do aviso |

---

## Rodada 4 (2026-07-04, feedback pós-correções)

| Item | Status | Detalhe |
|---|---|---|
| R1 Modal "Dados do Trabalho" pequeno demais (scroll desnecessário) | ✅ corrigido | Card de 34rem×max-w-xl → **46rem×max-w-2xl** (limitado a 90vh); conteúdo interno passou a ocupar a largura toda |
| R2 Seções do rail não são retráteis | ✅ corrigido | Cabeçalhos (Pré-textuais, Capítulos, Pós-textuais, Anexos…) viraram botões com chevron; estado persistido em `UiSettings.collapsedSections` (IndexedDB), como o colapso do rail |
| R3 Seção "Figuras" com nome errado | ✅ corrigido | Renomeada para **"Anexos"** — aceita imagem, PDF e código desde o §A4 (pasta no VFS continua `figuras/`) |
| R4 Digitação travada no editor visual | ✅ corrigido | Ver análise e correção abaixo |

### R4 — Por que digitar trava: diagnóstico exato

**Causa raiz: cada tecla dispara um re-parse LaTeX completo do projeto inteiro na main thread.** Medido com os arquivos reais do template uecetex2 (22 arquivos .tex, 72 KB): **~155 ms de trabalho síncrono por tecla** — bem acima dos ~16 ms de um frame. Num TCC real (3–5× o texto), escala linearmente para 400–700 ms/tecla.

Cadeia por tecla (todas as etapas são síncronas, no mesmo frame do keydown):

1. `EditorSurface.tsx:76-79` — `onUpdate` roda `editor.getJSON()` + `serializeDoc()` do documento inteiro e chama `onChange` **a cada transação**, sem debounce. (Custo pequeno — serialize usa cache de `rawSource` — mas é o gatilho de tudo abaixo.)
2. `store.tsx:100-109` — `updateFileText` cria **nova identidade de `project`** + novo `Set` de `dirtyPaths` + `setSaveState("saving")` → o valor do `ProjectContext` muda → **AppShell inteiro re-renderiza a cada tecla**.
3. `AppShell.tsx:136-142` — o memo `graph` tem deps `[project, texSources]`, ambas novas a cada tecla → **`buildIncludeGraph` re-executa**: `include-graph.ts:83` faz `parse()` do **unified-latex (AST completo) em todo arquivo .tex alcançável** por `\input`. **Medido: 147 ms/tecla no template padrão — é o vilão (~95% do custo).**
4. `useEditorResources.ts:39-127` — memo com dep `[project, …]` → **re-parse do `referencias.bib` inteiro** (`@retorquere/bibtex-parser`) a cada tecla. Medido: **7,8 ms/tecla**. A nova identidade de `resources` ainda re-renderiza todo NodeView que consome o contexto (chips de citação, figuras).
5. `AppShell.tsx:269-275` — `totalWords` re-conta palavras de **todos** os arquivos de prosa a cada tecla (deps em `texSources`, nova identidade sempre). Custo menor, mas na mesma soma.

Custos medidos que **não** são o problema: `serializeDoc` (<0,1 ms, cache de rawSource), `bytesToText` de todos os .tex (0,12 ms), plugin de busca (early-return com query vazia), RawSourceGuard (escaneia só os ranges alterados).

**Direção de correção (quando for pedida):** derivar `graph`/`resources`/`totalWords` com debounce (ou `useDeferredValue`), e/ou keyar os memos no **conteúdo** dos arquivos não abertos (que não muda ao digitar) em vez da identidade de `project`; `parseBib` só precisa rodar quando `referencias.bib` mudar. Nenhuma dessas derivadas precisa ser síncrona com a tecla.

**Correção aplicada (mesma sessão), em três frentes:**

1. **Debounce das derivadas pesadas** — `useDebouncedValue` (novo, `src/lib/use-debounced-value.ts`): `graph` e `totalWords` passam a derivar de uma cópia de `texSources` que só assenta 300 ms após a última tecla. Custo por tecla dessas derivadas: **zero**. Staleness de 300 ms é inócua: todo escritor (`createChapter`, `reorderChapters`, `applyWorkMetadata`) splica a fonte *viva*, nunca o grafo — e o único fluxo sensível (reordenar capítulo) passa por um `window.confirm`, muito mais lento que 300 ms.
2. **Cache por conteúdo no `buildIncludeGraph`** — o scan de cada arquivo (inputs/labels/bib) é função pura da string; memoizado num `Map` (teto de 256). O rebuild pós-pausa re-parseia **só o arquivo editado**: 238 ms frio → **63 ms** (maior capítulo, 22 KB) → **0,02 ms** com tudo em cache. A resolução de `\input` fica fora do cache (continua viva).
3. **Firewall de identidade no `useEditorResources`** — o parse do `.bib` é keyado no **conteúdo** do arquivo (string), não na identidade de `project`; listas de imagens/código keyadas por chave de caminhos; closures leem refs vivas. `resources` mantém a mesma identidade enquanto se digita → chips de citação e figuras **não re-renderizam mais a cada tecla** e o `.bib` só re-parseia quando muda.

Resultado: o trabalho por tecla cai de ~155 ms (template padrão; 400–700 ms num TCC real) para o custo base do editor (~1–2 ms de getJSON/serialize/encode), com um único rebuild de ~63 ms até 300 ms depois da pausa. Cobertura: 6 testes novos (debounce colapsando rajadas, invalidação do cache do scan, estabilidade de identidade + leituras vivas dos resources).

---

## 🔴 Críticos

### C1. Tabela inserida pela toolbar não é editável — e clicar nela corrompe outro trecho do documento
**Onde:** editor visual → botão "Inserir tabela" na toolbar.
**Evidência:** `23-insert-table.png`, `24-table-edit-test.png`, `25-undo-check.png`

A Onda 4 (histórico do projeto) registra "tabelas visuais" como entregue, mas o botão **"Inserir tabela"** da toolbar principal insere um bloco de LaTeX cru (`<code>`, não editável), idêntico ao padrão antigo criticado na primeira auditoria — não uma grade visual editável.

Pior: esse bloco **não é um alvo de clique válido no ProseMirror**. Cliquei diretamente em cima do texto da tabela (`A & B & C`) e o cursor do editor **pulou para o bloco `\label{cap:introducao}`, em outro lugar completamente diferente do documento** — confirmado via `document.getSelection()`, que apontava o texto `\label{cap:introducao}` como nó ativo. Ao digitar `999` para testar, o texto foi inserido silenciosamente dentro do `\label`, gerando `999\label{cap:introducao}` (revertido com Ctrl+Z para não deixar o documento sujo).

**Reprodução:**
1. Editor visual, qualquer capítulo → clique em "Inserir tabela" na toolbar.
2. Clique em cima do texto da tabela recém-inserida (ex.: `A & B & C`).
3. Digite qualquer coisa.
4. Observe que o texto aparece em `\label{cap:...}`, não na tabela.

**Impacto:** o usuário acredita estar editando a tabela e, na verdade, corrompe silenciosamente outro trecho do trabalho — sem qualquer aviso. Isso é mais grave que "tabela não editável": é perda de dados silenciosa.

### C2. Zero responsividade — app inutilizável em mobile e tablet
**Evidência:** `28-mobile-viewport.png` (390×844, tamanho de iPhone), `29-tablet-viewport.png` (768×1024, tamanho de tablet/notebook pequeno)

Testado com viewport de celular e de tablet:
- O painel de arquivos à esquerda **mantém largura fixa total**, não colapsa, não vira menu hambúguer.
- A toolbar superior estoura a largura da tela — "Menu" e "Sobre" ficam cortados/fora da área visível.
- O canvas do PDF **não escala para caber no container — ele estoura e corta** o conteúdo nas duas bordas ("...ERSIDADE ESTADUAL", "...RO DE CIÊNCIAS E TE" — texto cortado dos dois lados).
- Em 768px, o título do capítulo quebra de forma estranha ("Resultado" / "s" em linhas separadas) e a toolbar quebra em duas linhas sem reorganização coerente.

**Impacto:** qualquer aluno que tente revisar o trabalho no celular ou notebook pequeno (tela ≤ 1024px) encontra um app essencialmente quebrado, não apenas "apertado".

---

## 🟠 Altos

### A1 (item do usuário #1). Preview de PDF não reage à mudança de tema
**Evidência:** `05-after-compile.png` (claro) vs `06-dark-mode-pdf.png` + `07-pdf-pane-dark-zoom.png` (escuro, zoom)

Confirmado e localizada a causa: ao alternar "Tema: automático → claro → escuro" (botão no topo, `title="Tema: ..."`), toda a aplicação escurece corretamente — **exceto** a área de scroll do preview de PDF. Inspecionei o DOM:

- O `<section>` que envolve o preview usa `bg-surface`, que **resolve corretamente** para `oklch(0.2 ...)` (escuro) — ok.
- Mas o `<div>` interno que envolve as páginas (`overflow-auto`) usa a classe `bg-ink/5`, que resulta em `oklab(0.96 ... / 5%)` — **quase branco**, e visualmente domina a área toda (não só a página em si, mas a "moldura"/gutter ao redor dela).
- O `<div>` da própria página usa `bg-white` fixo (aceitável — é o "papel"), mas a margem/gutter ao redor deveria escurecer como em qualquer leitor de PDF (Chrome, VS Code) e não escurece.

Resultado: no modo escuro, toda a interface fica escura e a área do PDF (moldura + página) continua uma ilha branca berrante — exatamente o que você reportou. Existe um botão separado "Modo escuro do PDF (inverter cores)" que inverte as cores do conteúdo da página, mas ele é uma ação manual e não resolve a moldura/gutter, que deveria acompanhar o tema do app automaticamente.

### A2 (item do usuário #4). Find & Replace só existe no modo Fonte, nunca no editor visual
**Evidência:** `15-introducao-visual-mode.png` (visual, sem "Localizar") vs `16-introducao-source-mode.png` (fonte, com "Localizar")

Confirmado 1:1. Testei o mesmo arquivo (`introducao.tex`) nos dois modos:
- **Editor visual (Tiptap, modo padrão):** cabeçalho mostra só "Fonte LaTeX" (botão de alternância). Nenhum find/replace em lugar nenhum, mesmo em capítulos longos.
- **Fonte LaTeX (CodeMirror):** cabeçalho mostra "Localizar", com painel completo (busca, próximo/anterior, substituir, substituir tudo, regex, case-sensitive, palavra inteira) — testado e funcional (busquei "Lorem", "próximo" destacou a primeira ocorrência corretamente).

**Impacto:** como o editor visual é o modo padrão e a maioria do trabalho de escrita acontece nele, a maior parte do tempo o usuário simplesmente não tem find/replace disponível — precisa saber que existe um modo "Fonte LaTeX" escondido para conseguir buscar texto.

### A3 (item do usuário #5). Wizard "Dados do Trabalho" ocupa a área de edição em vez de flutuar
**Evidência:** `01-initial-load.png` (modal "Bem-vindo" flutuante, correto) vs `02-wizard-open.png` (wizard ocupando o painel do meio)

Confirmado. Há uma inconsistência interessante no próprio app: o modal de boas-vindas ("Bem-vindo ao UeceTexLive!") **é implementado corretamente** como overlay flutuante com fundo escurecido, sobre toda a tela. Mas ao clicar em "Preencher dados" (ou no item "Dados do Trabalho" da barra lateral), o wizard de 5 passos **substitui completamente o conteúdo do painel central** — a área que deveria mostrar o editor. O painel de arquivos (esquerda) e o preview de PDF (direita) continuam visíveis, mas a área de escrita simplesmente desaparece por trás do wizard, dando a impressão de que o conteúdo do capítulo sumiu.

**Impacto:** o padrão de diálogo já existe e funciona bem no app (modal de boas-vindas) — bastaria reaproveitá-lo para o wizard, em vez de tratá-lo como uma "view" que ocupa o slot do editor.

### A4 (item do usuário #3). Upload de PDF e de código-fonte não existe; upload de imagem existe mas está escondido
**Evidência:** `09-insert-figura-click.png`, `10-after-image-upload.png`, `30-menu-dropdown.png`

Testei os três tipos de arquivo:
- **Imagem:** funciona tecnicamente! Toolbar → "Inserir figura" abre um popover de busca com uma opção de texto discreta no topo, **"Enviar imagem do computador…"** (só aparece via detecção de elemento clicável, não tem foco/destaque visual de botão). Fiz upload de um PNG de teste e funcionou: a figura foi inserida no documento e o arquivo apareceu na lista lateral em "FIGURAS". Ou seja, a função existe, mas está **mal sinalizada** — não há nenhum "+" ou zona de drag-and-drop visível na própria lista de arquivos, só esse link de texto dentro de um submenu de inserção.
- **PDF:** **não existe nenhum caminho de upload individual.** Inspecionei todos os `<input type="file">` do DOM: só existem três, com `accept=".zip"`, `accept=".bbl"` e `accept=".png,.jpg,.jpeg"`. Não há input para PDF em lugar nenhum da aplicação.
- **Código-fonte (.cpp, etc.):** mesma conclusão — nenhum input de upload aceita esse tipo de arquivo. A única forma de trazer um `.cpp`/`.tex` extra para o projeto é importando um **projeto ZIP inteiro** via Menu → "Importar ZIP".

**Impacto:** o usuário que quer trocar a ficha catalográfica (PDF) ou anexar um código-fonte (comum em TCCs de computação) não tem nenhuma forma direta de fazer isso — só reimportando o projeto inteiro como ZIP.

### A5 (item do usuário #2). Cabeçalho do editor e do preview desalinhados — 4px de diferença, medido
**Evidência:** `04-header-misalign-zoom.png` (zoom no ponto de encontro dos dois cabeçalhos)

Confirmado e medido via `getBoundingClientRect()`:
- Cabeçalho do editor (esquerda, linha "619 palavras · Fonte LaTeX"): `height: 32px` (classe `h-8`), de `top:48` a `bottom:80`.
- Cabeçalho do preview (direita, abas "PDF"/"Log"): `height: 36px`, de `top:48` a `bottom:84`.

Ambos começam no mesmo `top:48`, mas como as alturas diferem em 4px, a borda inferior de um cabeçalho fica 4px mais baixa que a do outro — visível no zoom como uma linha de borda "degrau" bem no encontro dos dois painéis. É um bug de CSS pontual (paddings/alturas divergentes entre os dois componentes de cabeçalho), não uma percepção subjetiva.

---

## 🟡 Médios

### M1. "Novo capítulo" usa `window.prompt()` nativo do navegador — quebra a identidade visual e falha em silêncio
**Evidência:** log de dialogs capturado durante o teste (`"Título do novo capítulo:" → accepted`)

O botão "+" ao lado de "CAPÍTULOS" não abre um diálogo do próprio app — ele dispara um `window.prompt()` nativo do navegador, sem nenhuma estilização, inconsistente com o resto da interface (que tem um design system cuidado, com o wizard, popovers etc.). Além disso: se o prompt for cancelado ou aceito com o campo vazio, **nada acontece — nenhum capítulo é criado e nenhuma mensagem de erro ou feedback aparece**. Só percebi que o clique "não fazia nada" ao inspecionar o dialog log; para um usuário real, os dois primeiros cliques no botão pareceriam simplesmente quebrados.

### M2. LaTeX gerado malformado ao inserir figura antes do título do capítulo
**Evidência:** `17-malformed-source-zoom.png`

Ao inserir uma figura (via upload) posicionado antes do heading "Introdução" e depois alternar para o modo "Fonte LaTeX", o código gerado ficou:
```
\end{figure}\chapter{Introdução}
```
— `\end{figure}` e `\chapter{...}` concatenados na mesma linha, sem quebra entre eles. Tecnicamente o LaTeX ainda compila (espaço não importa para esses comandos), mas o serializador do AST para LaTeX deveria inserir uma quebra de linha/parágrafo em branco separando blocos distintos, como faz em outros pontos do documento. Isso deixa o `.tex` gerado com formatação inconsistente, dificulta diffs no controle de versão e pode confundir usuários avançados que editam a fonte diretamente.

### M3. Painel de inserção mostra o rótulo errado ("Tabela") ao abrir a busca de citação
**Evidência:** `32-citation-fresh.png` (reprodução em estado limpo, após reload)

Cliquei em "Citação bibliográfica" na toolbar e o popover que abre — corretamente populado com resultados de citação (LAMPORT 1986, KNUTH 1986, BORGES 2012 etc.) — mostra o cabeçalho fixo **"Tabela"** (com o link "editar como LaTeX" ao lado), não algo como "Citação" ou "Referência". Parece que o componente de popover de inserção é compartilhado entre tabela/citação/figura e o rótulo do cabeçalho não é atualizado para refletir o comando atual.

### M4. Popovers/menus não se fecham entre si — dois ficam abertos ao mesmo tempo
**Evidência:** `31-citation-picker.png`

Abri o menu "Menu" (Exportar/Importar/Restaurar) no canto superior direito e, sem fechá-lo explicitamente, cliquei em "Citação bibliográfica" na toolbar. Resultado: **os dois popovers ficaram abertos simultaneamente**, sobrepostos na tela (visível no canto superior direito da captura). `Escape` também não fechou o menu "Menu" sozinho. Indica que os popovers da aplicação não compartilham um gerenciador de estado "só um aberto por vez", o que pode gerar sobreposições confusas em fluxos reais de uso.

### M5. Clicar em um arquivo PDF na lista deixa a área de edição completamente vazia, sem explicação
**Evidência:** `13-click-ficha-catalografica.png`

Cliquei em `ficha-catalografica.pdf` na barra lateral (arquivo é selecionado/destacado em verde, indicando que "abriu"), mas o painel central de edição fica **totalmente em branco** — nenhum texto, nenhuma mensagem como "arquivos PDF não podem ser editados aqui", nenhuma prévia, nenhum botão de download/substituir. Para o usuário, parece que o app travou ou que o arquivo está corrompido. Comparação: clicar em `main.cpp` (arquivo de código) funciona bem — abre em modo fonte com syntax highlighting e até o botão "Localizar" disponível (`14-click-maincpp.png`). O tratamento para PDFs deveria, no mínimo, ter um estado equivalente ("este tipo de arquivo não é editável aqui — [Baixar] [Substituir]").

---

## 🟢 Baixos / polimento

### B1. Find & Replace não mostra contador de ocorrências
**Evidência:** `20-find-lorem.png`, `21-find-next-click.png`

O painel de busca (modo Fonte) funciona bem (testei busca + "próximo", destacou corretamente a primeira ocorrência de "Lorem"), mas não mostra nenhum contador tipo "1 de 12" como é padrão em VS Code, navegadores etc. Sem isso, o usuário não sabe quantas ocorrências existem nem em qual está posicionado.

### B2. "11 arquivos avançados ocultos" parece clicável mas não é
**Evidência:** DOM inspecionado — `data-testid="rail-hidden-count"`, `title="Marque "Avançado" na barra superior para vê-los"`

O texto tem um `title` de tooltip que soa como uma instrução de ação, mas o elemento não é um botão nem tem link — é só texto estático. O usuário precisa voltar o olhar até o topo da tela para achar o checkbox "Avançado" manualmente. Um pequeno link/atalho aqui economizaria esse vaivém.

---

## Pontos positivos observados nesta rodada

- **Motor de compilação segue excelente**: 47 páginas compiladas no navegador (WASM), sem erros de console críticos — só warnings benignos (`Math.sumPrecise is not a function`, fonte de sistema ausente).
- **Upload de imagem funciona de ponta a ponta** tecnicamente (arquivo enviado, inserido no documento, listado na barra lateral) — o problema é só de descoberta/visibilidade, não de funcionamento.
- **Find & Replace no modo Fonte** é robusto: regex, case-sensitive, palavra inteira, substituir/substituir tudo — só falta chegar ao editor visual.
- **Citation picker** retorna resultados relevantes rapidamente (apesar do bug de rótulo do cabeçalho).
- **Modo "Avançado"** funciona como esperado, revelando arquivos adicionais do template (documento.tex, preambulo.tex, .sty, .bst etc.) sem quebrar nada.
- **main.cpp e arquivos de código** abrem corretamente em modo fonte com "Localizar" disponível.

---

## Top 3 para priorizar

1. **C1 — corrupção silenciosa ao clicar em tabela inserida.** É o único achado com risco real de perda de trabalho do usuário sem aviso nenhum.
2. **C2 — responsividade zero.** Qualquer uso fora de desktop grande está bloqueado hoje.
3. **A1 + A5 — preview de PDF no escuro + desalinhamento de cabeçalho.** Ambos são bugs de CSS localizados (classe de background errada; alturas de container divergentes), baratos de corrigir e com alto impacto visual/percepção de qualidade.
