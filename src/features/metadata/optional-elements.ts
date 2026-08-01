/**
 * Nomes humanos dos elementos opcionais, para o passo "Elementos opcionais"
 * do guia. O inventário técnico (macro ↔ arquivo) vive em
 * `project/imprimir-toggles.ts`; aqui só entra como o aluno os chama.
 */

import { LANGUAGE_MACRO, TOGGLE_FILES } from "@/features/project/imprimir-toggles";

export interface OptionalElement {
  macro: string;
  label: string;
  hint?: string;
}

/** Páginas com arquivo próprio — cada uma tem texto que o aluno escreve. */
export const OPTIONAL_PAGES: readonly OptionalElement[] = [
  { macro: "imprimirdedicatoria", label: "Dedicatória" },
  { macro: "imprimiragradecimentos", label: "Agradecimentos" },
  { macro: "imprimirepigrafe", label: "Epígrafe" },
  {
    macro: "imprimirerrata",
    label: "Errata",
    hint: "Só depois que o trabalho já foi entregue, para registrar uma correção.",
  },
  {
    macro: "imprimirlistadeabreviaturasesiglas",
    label: "Lista de abreviaturas e siglas",
  },
  { macro: "imprimirlistadesimbolos", label: "Lista de símbolos" },
  { macro: "imprimirglossario", label: "Glossário" },
];

/**
 * Listas que o modelo monta sozinho a partir do que existe no texto.
 *
 * Apêndices e anexos ficam de fora de propósito: a macro só troca o modo de
 * numeração e os `\input` dos arquivos continuam ativos na linha seguinte —
 * desmarcar aqui deixaria os capítulos no PDF numerados como capítulos
 * comuns. Quem cria um apêndice usa o diálogo "Novo capítulo", que liga a
 * seção junto.
 */
export const AUTOMATIC_LISTS: readonly OptionalElement[] = [
  { macro: "imprimirlistadeilustracoes", label: "Lista de ilustrações" },
  { macro: "imprimirlistadetabelas", label: "Lista de tabelas" },
  { macro: "imprimirlistadequadros", label: "Lista de quadros" },
  { macro: "imprimirlistadealgoritmos", label: "Lista de algoritmos" },
  { macro: "imprimirlistadecodigosfonte", label: "Lista de códigos-fonte" },
  { macro: "imprimirindice", label: "Índice remissivo" },
];

/** Trabalho escrito em inglês — a mesma mecânica, fora dos dois grupos. */
export const LANGUAGE_ELEMENT: OptionalElement = {
  macro: LANGUAGE_MACRO,
  label: "Escrever o trabalho em inglês",
  hint: "Troca os títulos automáticos (SUMÁRIO, REFERÊNCIAS…) para o inglês.",
};

/** Toda página listada aqui precisa existir no inventário técnico. */
export function optionalPagePath(macro: string): string | undefined {
  return TOGGLE_FILES.get(macro);
}
