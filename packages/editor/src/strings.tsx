/**
 * Copy do editor, injetável (Fase 2 do package_extraction.md): os
 * componentes leem via useEditorStrings() em vez de importar o singleton de
 * copy do app. O default é a copy PT-BR original — um consumidor (Papyru)
 * sobrescreve por grupo via EditorStringsProvider.
 */
import { createContext, type ReactNode, useContext, useMemo } from "react";

export interface EditorStrings {
  editor: {
    placeholder: string;
    rawLatexTooltip: string;
    find: string;
    findHint: string;
    findPlaceholder: string;
    findReplacePlaceholder: string;
    findNext: string;
    findPrev: string;
    findReplace: string;
    findReplaceAll: string;
    findCase: string;
    findWord: string;
    findRegex: string;
    findClose: string;
    findNoMatches: string;
    tableLabel: string;
    editAsLatex: string;
    uploadImage: string;
    uploadImageError: string;
  };
  toolbar: {
    bold: string;
    italic: string;
    underline: string;
    code: string;
    chapter: string;
    section: string;
    subsection: string;
    bulletList: string;
    orderedList: string;
    blockquote: string;
    citation: string;
    crossref: string;
    figure: string;
    table: string;
    equation: string;
  };
  preview: {
    empty: string;
    stale: string;
    invert: string;
    zoomIn: string;
    zoomOut: string;
    draftBanner: string;
    prevPage: string;
    nextPage: string;
    pageInput: string;
  };
}

export type EditorStringsOverride = {
  [G in keyof EditorStrings]?: Partial<EditorStrings[G]>;
};

export const DEFAULT_EDITOR_STRINGS: EditorStrings = {
  editor: {
    placeholder: "Escreva, ou digite / para inserir…",
    rawLatexTooltip:
      "LaTeX bruto — o UeceTexLive preserva este trecho exatamente como está",
    find: "Localizar",
    findHint: "Localizar e substituir (Ctrl+F)",
    findPlaceholder: "Localizar",
    findReplacePlaceholder: "Substituir",
    findNext: "próximo",
    findPrev: "anterior",
    findReplace: "substituir",
    findReplaceAll: "substituir tudo",
    findCase: "diferenciar maiúsculas",
    findWord: "palavra inteira",
    findRegex: "regex",
    findClose: "fechar",
    findNoMatches: "nenhuma ocorrência",
    tableLabel: "Tabela",
    editAsLatex: "editar como LaTeX",
    uploadImage: "Enviar imagem ou PDF do computador…",
    uploadImageError: "Não foi possível enviar — use PNG, JPG ou PDF de até 10 MB.",
  },
  toolbar: {
    bold: "Negrito",
    italic: "Itálico",
    underline: "Sublinhado",
    code: "Monoespaçado",
    chapter: "Título de capítulo",
    section: "Seção",
    subsection: "Subseção",
    bulletList: "Lista com marcadores",
    orderedList: "Lista numerada",
    blockquote: "Citação longa (ABNT 4cm)",
    citation: "Citação bibliográfica",
    crossref: "Referência cruzada",
    figure: "Inserir figura",
    table: "Inserir tabela",
    equation: "Inserir equação",
  },
  preview: {
    empty: "Compile para ver o PDF aqui.",
    stale: "Compilando…",
    invert: "Modo escuro do PDF (inverter cores)",
    zoomIn: "Aumentar zoom",
    zoomOut: "Reduzir zoom",
    draftBanner:
      "Modo rascunho: citações, glossário e índice não são resolvidos. Use a compilação Completa para o PDF final.",
    prevPage: "Página anterior",
    nextPage: "Próxima página",
    pageInput: "Ir para a página",
  },
};

const EditorStringsContext = createContext<EditorStrings>(DEFAULT_EDITOR_STRINGS);

export function useEditorStrings(): EditorStrings {
  return useContext(EditorStringsContext);
}

export function EditorStringsProvider({
  strings,
  children,
}: {
  strings?: EditorStringsOverride;
  children: ReactNode;
}) {
  const value = useMemo<EditorStrings>(
    () => ({
      editor: { ...DEFAULT_EDITOR_STRINGS.editor, ...strings?.editor },
      toolbar: { ...DEFAULT_EDITOR_STRINGS.toolbar, ...strings?.toolbar },
      preview: { ...DEFAULT_EDITOR_STRINGS.preview, ...strings?.preview },
    }),
    [strings],
  );
  return (
    <EditorStringsContext.Provider value={value}>
      {children}
    </EditorStringsContext.Provider>
  );
}
