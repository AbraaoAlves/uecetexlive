# @uecetexlive/editor

Superfície de edição WYSIWYG (Tiptap) + editor de fonte LaTeX (CodeMirror)
do UeceTexLive, extraídos como pacote. O sub-export `./preview` traz os
painéis de PDF (pdf.js) e de log de compilação.

```ts
import { EditorSurface, SourceEditor, useEditorResources } from "@uecetexlive/editor";
import { LogPane, PdfPane } from "@uecetexlive/editor/preview";
```

## Norma de citação

O schema, o parse e o serialize compartilham **um** objeto de configuração:
o `CitationProfile` de `@uecetexlive/latex-mapping` (default ABNT —
`citeonline`/`Citeonline` + ambiente `citacao`). Passe outro perfil via
`<EditorSurface citationProfile={...}>` ou `buildExtensions({ citationProfile })`.

## Copy (i18n)

Nenhum componente importa copy do app. Os textos vêm de um contexto com
default PT-BR (`DEFAULT_EDITOR_STRINGS`); sobrescreva por grupo:

```tsx
<EditorStringsProvider strings={{ toolbar: { bold: "Bold" } }}>
  <EditorSurface ... />
</EditorStringsProvider>
```

Grupos disponíveis: `editor` (placeholder, localizar/substituir, tabela,
upload), `toolbar` (rótulos dos botões) e `preview` (PDF/log). Textos que os
componentes *já* tinham inline antes da extração (títulos de picker, estados
vazios) seguem inline — abra issue se precisar sobrescrevê-los.

## Estilo — o contrato

O pacote **não embarca CSS**. A skin chega por três ganchos:

1. **Tokens semânticos.** As classes utilitárias dos componentes usam apenas
   o vocabulário `background`, `surface`, `surface-elevated`, `ink`,
   `ink-muted`, `ink-subtle`, `accent`, `accent-soft`, `accent-strong`,
   `border`, `ring`, `warning`, `danger`. Num app Tailwind v4, declare esses
   tokens no seu `@theme` (viram CSS custom properties) e inclua o source do
   pacote no scan (`@source "../node_modules/@uecetexlive/editor/src";`) —
   o UeceTexLive é o exemplo de referência.
2. **Ganchos de dados.** Todo elemento relevante carrega `data-testid`
   estável (`editor-toolbar`, `find-panel`, `pdf-pane`, …) e os nós do
   schema emitem classes semânticas `uecetex-*` (`uecetex-raw-block`,
   `uecetex-comment`, …) — estilizáveis por CSS puro, sem Tailwind.
3. **KaTeX.** `EditorSurface` importa `katex/dist/katex.min.css`; seu
   bundler precisa aceitar import de CSS.

## Dependências

`react`/`react-dom` e a família `@tiptap/*` são **peerDependencies** (faixas
compatíveis, não versões exatas). CodeMirror, KaTeX, pdf.js e o parser de
BibTeX são dependências diretas.
