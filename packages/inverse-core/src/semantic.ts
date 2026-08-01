/**
 * Stage 2 — Semantic tree.
 *
 * Output of the rule-based classifier. Every node carries the 0-based
 * page index where it starts, so Stage 3 can emit deterministic,
 * source-ordered LaTeX and so validation can point at the exact page.
 */

export type HeadingLevel = "chapter" | "section" | "subsection" | "subsubsection";

export interface HeadingNode {
  kind: "heading";
  level: HeadingLevel;
  /** False for RESUMO, REFERÊNCIAS, APÊNDICE etc. */
  numbered: boolean;
  /** "2.1" — absent for unnumbered headings. */
  number?: string;
  title: string;
  page: number;
}

export interface ParagraphNode {
  kind: "paragraph";
  text: string;
  /** True when the paragraph contains glyphs from math fonts (inline math). */
  hasInlineMath: boolean;
  page: number;
}

/** Citação longa ABNT (recuo 4cm, fonte reduzida). */
export interface QuoteNode {
  kind: "quote";
  text: string;
  page: number;
}

export interface ListNode {
  kind: "list";
  /** "alpha" => alíneas a)/(a); "numeric" => 1. 2.; "bullet" => itemize. */
  style: "alpha" | "numeric" | "bullet";
  items: string[];
  page: number;
}

export interface FigureNode {
  kind: "figure";
  number: number;
  caption: string;
  /** "Fonte: ..." line, when present. */
  source?: string;
  /** Exported asset filenames (sha-derived, deterministic). */
  imageFiles: string[];
  page: number;
}

export interface TableNode {
  kind: "table";
  /** Figura-like caption label: Tabela or Quadro. */
  label: "Tabela" | "Quadro";
  number: number;
  caption: string;
  source?: string;
  /** Row-major cell text, reconstructed from rule bands + column x. */
  rows: string[][];
  /**
   * Largura de cada coluna como fração da largura da tabela, medida das
   * posições x observadas. Necessária para emitir colunas `p{}` que quebram
   * onde o original quebra — `l` estouraria a margem.
   */
  colWidths?: number[];
  page: number;
}

/**
 * Display math region. `raw` is the glyph text as extracted — NOT valid
 * LaTeX. Symbolic reconstruction is a later phase; Stage 3 emits a
 * placeholder plus a cropped snapshot reference.
 */
export interface DisplayMathNode {
  kind: "displayMath";
  raw: string;
  page: number;
}

export interface CodeNode {
  kind: "code";
  variant: "listing" | "algorithm";
  /** "Código-fonte N – …" / "Algoritmo N: …" caption, when present. */
  caption?: string;
  lines: string[];
  page: number;
}

export type BodyNode =
  | HeadingNode
  | ParagraphNode
  | QuoteNode
  | ListNode
  | FigureNode
  | TableNode
  | DisplayMathNode
  | CodeNode;

export interface FootnoteEntry {
  marker: string;
  text: string;
  page: number;
}

export interface BibEntry {
  /** Full entry text, joined and de-hyphenated. */
  raw: string;
  /** Bold sub-runs (abnt-emphasize=bf) — the work title. */
  emphasized: string[];
  page: number;
}

export interface PretextualSection {
  /** Canonical heading (RESUMO, ABSTRACT, AGRADECIMENTOS…). */
  title: string;
  paragraphs: string[];
  page: number;
}

/**
 * Dados das páginas pré-textuais que não são "seções": capa, folha de rosto,
 * ficha catalográfica e folha de aprovação. O classificador antes as
 * descartava (`if (!pendingSection) continue`), o que obrigava o emissor a
 * deixar os placeholders do template — e o PDF gerado saía com capa, cidade,
 * ano, orientador e banca errados, além de páginas que o original não tem.
 */
export interface FrontMatter {
  /** Linhas de cabeçalho da capa, em ordem (IES, UAB, centro, curso). */
  institutionLines: string[];
  /** Cidade e ano do rodapé da capa ("CAUCAIA – CEARÁ", "2026"). */
  city?: string;
  year?: string;
  /** Parágrafo de natureza do trabalho, da folha de rosto. */
  preamble?: string;
  /** "Prof. Me. José Henrique Brandão Neto" — sem o rótulo "Orientador:". */
  advisor?: string;
  /** Membros da banca na ordem da folha de aprovação (o 1º é o orientador). */
  board: { name: string; center?: string; ies?: string }[];
  /** Quais páginas pré-textuais o original tem — governa os \imprimir*. */
  has: {
    catalogCard: boolean;
    approvalSheet: boolean;
    illustrationList: boolean;
    tableList: boolean;
    abbreviationList: boolean;
    symbolList: boolean;
  };
}

export interface SemanticDoc {
  /** Straight from the PDF Info dictionary. */
  metadata: { title?: string; author?: string };
  frontMatter: FrontMatter;
  pretextual: PretextualSection[];
  body: BodyNode[];
  footnotes: FootnoteEntry[];
  bibliography: BibEntry[];
  /** Post-textual unnumbered chapters (GLOSSÁRIO, APÊNDICE, ANEXO…). */
  posttextual: PretextualSection[];
  /** Classifier accounting — lines it could not attribute, for auditing. */
  unclassified: { page: number; text: string }[];
}
