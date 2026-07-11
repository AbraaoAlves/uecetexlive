/**
 * Campos por tipo de entry, rótulos PT e obrigatoriedade (§5.3/§5.9
 * UI_UX_PLAN) — consumido pelo form (B3/B2) e pelo lint (B6).
 */
import type { BibFieldValue, EntryType } from "./types";

export interface FieldSpec {
  readonly name: string;
  readonly labelPt: string;
  readonly required: boolean;
}

export const ENTRY_TYPE_LABELS_PT: Record<EntryType, string> = {
  article: "Artigo de revista",
  inproceedings: "Artigo de congresso",
  book: "Livro",
  incollection: "Capítulo de livro",
  phdthesis: "Tese",
  mastersthesis: "Dissertação",
  techreport: "Relatório técnico",
  misc: "Outro (site, vídeo…)",
  unpublished: "Não publicado",
};

const AUTHOR: FieldSpec = { name: "author", labelPt: "Autor", required: true };
const TITLE: FieldSpec = { name: "title", labelPt: "Título", required: true };
const YEAR: FieldSpec = { name: "year", labelPt: "Ano", required: true };

export const ENTRY_FIELD_SPECS: Record<EntryType, readonly FieldSpec[]> = {
  article: [
    AUTHOR,
    TITLE,
    { name: "journal", labelPt: "Revista", required: true },
    YEAR,
    { name: "volume", labelPt: "Volume", required: false },
    { name: "number", labelPt: "Número", required: false },
    { name: "pages", labelPt: "Páginas", required: false },
    { name: "doi", labelPt: "DOI", required: false },
    { name: "url", labelPt: "URL", required: false },
  ],
  inproceedings: [
    AUTHOR,
    TITLE,
    { name: "booktitle", labelPt: "Nome do evento", required: true },
    YEAR,
    { name: "pages", labelPt: "Páginas", required: false },
    { name: "publisher", labelPt: "Editora", required: false },
    { name: "doi", labelPt: "DOI", required: false },
  ],
  book: [
    AUTHOR,
    TITLE,
    { name: "publisher", labelPt: "Editora", required: true },
    YEAR,
    { name: "edition", labelPt: "Edição", required: false },
    { name: "address", labelPt: "Cidade", required: false },
    { name: "note", labelPt: "ISBN", required: false },
  ],
  incollection: [
    AUTHOR,
    { name: "title", labelPt: "Título do capítulo", required: true },
    { name: "booktitle", labelPt: "Título do livro", required: true },
    { name: "publisher", labelPt: "Editora", required: true },
    YEAR,
    { name: "editor", labelPt: "Organizadores", required: false },
    { name: "pages", labelPt: "Páginas", required: false },
  ],
  phdthesis: [
    AUTHOR,
    TITLE,
    { name: "school", labelPt: "Instituição", required: true },
    YEAR,
    { name: "address", labelPt: "Cidade", required: false },
  ],
  mastersthesis: [
    AUTHOR,
    TITLE,
    { name: "school", labelPt: "Instituição", required: true },
    YEAR,
    { name: "address", labelPt: "Cidade", required: false },
  ],
  techreport: [
    AUTHOR,
    TITLE,
    { name: "institution", labelPt: "Instituição", required: true },
    YEAR,
    { name: "number", labelPt: "Número", required: false },
  ],
  unpublished: [AUTHOR, TITLE, { name: "note", labelPt: "Nota", required: false }],
  misc: [
    TITLE,
    { name: "author", labelPt: "Autor", required: false },
    { name: "year", labelPt: "Ano", required: false },
    { name: "url", labelPt: "URL", required: false },
    // ADR-04: campos literais do abntex2-alf.bst, não "note" (ver §5.9).
    { name: "urlaccessdate", labelPt: "Acesso em", required: false },
  ],
};

export function missingRequiredFields(
  entryType: EntryType,
  fields: ReadonlyMap<string, BibFieldValue>,
): string[] {
  return ENTRY_FIELD_SPECS[entryType]
    .filter((spec) => spec.required && !fields.has(spec.name))
    .map((spec) => spec.name);
}
