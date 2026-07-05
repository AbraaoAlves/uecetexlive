/**
 * A única variação por norma institucional reconhecida pelo parser (§4.3).
 * Headings/marks/crossrefs são LaTeX universal e ficam fixos em parse.ts;
 * o que muda entre normas (ABNT, APA, …) é o vocabulário de citação inline
 * e o ambiente de citação direta longa.
 */
export interface CitationProfile {
  /** Comandos de citação inline reconhecidos (além dos genéricos cite/citep/citet). */
  citeCommands: string[];
  /** Nome do ambiente LaTeX para citação direta longa (bloco recuado). */
  longQuoteEnv: string;
}

/** Comportamento histórico do app (abnTeX2/abntex2cite) — default de parse/serialize. */
export const ABNT_CITATION_PROFILE: CitationProfile = {
  citeCommands: ["citeonline", "Citeonline"],
  longQuoteEnv: "citacao",
};
