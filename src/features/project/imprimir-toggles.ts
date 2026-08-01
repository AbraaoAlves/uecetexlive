/**
 * Elementos opcionais do uecetex2 — ligar/desligar sem abrir o documento.
 *
 * No modelo, incluir ou não uma página opcional é exatamente comentar ou
 * descomentar a linha `\imprimir…` dentro de `\begin{document}`. Por isso
 * este módulo trabalha por linha, sem AST: o estado "desligado" é o que
 * qualquer parser LaTeX descartaria como comentário.
 *
 * Regra que não muda: nunca criar uma linha que não existe. Uma macro
 * ausente do documento não vira controle na interface — mesma disciplina do
 * campo desabilitado do wizard.
 */

export interface ImprimirToggle {
  /** Sem a barra: "imprimiragradecimentos". */
  macro: string;
  /** A linha não está comentada. */
  enabled: boolean;
  /** Conteúdo do `{…}`, quando a macro tem argumento. */
  argument: string | null;
  /** Offset do primeiro byte da linha, para o splice cirúrgico. */
  lineStart: number;
}

/** Macros com um arquivo próprio no painel — cada uma vira um checkbox. */
export const TOGGLE_FILES: ReadonlyMap<string, string> = new Map([
  ["imprimirerrata", "elementos-pre-textuais/errata.tex"],
  ["imprimirdedicatoria", "elementos-pre-textuais/dedicatoria.tex"],
  ["imprimiragradecimentos", "elementos-pre-textuais/agradecimentos.tex"],
  ["imprimirepigrafe", "elementos-pre-textuais/epigrafe.tex"],
  [
    "imprimirlistadeabreviaturasesiglas",
    "elementos-pre-textuais/lista-de-abreviaturas-e-siglas.tex",
  ],
  ["imprimirlistadesimbolos", "elementos-pre-textuais/lista-de-simbolos.tex"],
  ["imprimirglossario", "elementos-pos-textuais/glossario.tex"],
]);

/**
 * Listas que o modelo monta sozinho — sem arquivo correspondente.
 *
 * Cuidado com `imprimirapendices`/`imprimiranexos`: elas só trocam o modo de
 * numeração; os `\input` dos apêndices vêm nas linhas seguintes. Desligar a
 * macro sem tratar esses `\input` deixa os capítulos no texto, numerados como
 * capítulos comuns. Quem expuser esses dois na interface precisa resolver isso.
 */
export const TOGGLE_LISTS: readonly string[] = [
  "imprimirlistadeilustracoes",
  "imprimirlistadetabelas",
  "imprimirlistadequadros",
  "imprimirlistadealgoritmos",
  "imprimirlistadecodigosfonte",
  "imprimirapendices",
  "imprimiranexos",
  "imprimirindice",
];

/**
 * Uma linha inteira, e só ela: indentação, comentário opcional, a macro com
 * seu argumento e nada mais. Comentário à direita não casa — o toggle não
 * apagaria a observação do autor ao religar a linha.
 */
const TOGGLE_LINE = /^([ \t]*)(%[ \t]*)?(\\(imprimir[a-z]+)(?:\{([^}]*)\})?)[ \t]*$/;

interface Scan {
  toggle: ImprimirToggle;
  /** Bytes entre o início da linha e o começo da macro (indentação + `%`). */
  prefixLength: number;
  commentLength: number;
}

/** Percorre só o corpo do documento, linha a linha; a última macro vence. */
function scan(source: string): Map<string, Scan> {
  const out = new Map<string, Scan>();
  const bodyStart = source.indexOf("\\begin{document}");
  if (bodyStart === -1) return out;
  const docEnd = source.indexOf("\\end{document}", bodyStart);
  const bodyEnd = docEnd === -1 ? source.length : docEnd;

  let lineStart = bodyStart;
  while (lineStart < bodyEnd) {
    const newline = source.indexOf("\n", lineStart);
    const lineEnd = newline === -1 || newline > bodyEnd ? bodyEnd : newline;
    const match = TOGGLE_LINE.exec(source.slice(lineStart, lineEnd));
    if (match) {
      const [, indent = "", comment, , macro = "", argument] = match;
      out.set(macro, {
        toggle: {
          macro,
          enabled: comment === undefined,
          argument: argument ?? null,
          lineStart,
        },
        prefixLength: indent.length + (comment?.length ?? 0),
        commentLength: comment?.length ?? 0,
      });
    }
    lineStart = lineEnd + 1;
  }
  return out;
}

export function extractImprimirToggles(source: string): Map<string, ImprimirToggle> {
  const out = new Map<string, ImprimirToggle>();
  for (const [macro, entry] of scan(source)) out.set(macro, entry.toggle);
  return out;
}

/**
 * Liga ou desliga a macro comentando a linha. Devolve o documento inalterado
 * quando a macro não existe ou já está no estado pedido.
 */
export function applyImprimirToggle(
  source: string,
  macro: string,
  enabled: boolean,
): string {
  const entry = scan(source).get(macro);
  if (!entry || entry.toggle.enabled === enabled) return source;

  const { lineStart } = entry.toggle;
  const indentLength = entry.prefixLength - entry.commentLength;
  if (enabled) {
    // Remove só o `%` e os espaços que vinham logo depois dele.
    const cut = lineStart + entry.prefixLength;
    return source.slice(0, lineStart + indentLength) + source.slice(cut);
  }
  const at = lineStart + indentLength;
  return `${source.slice(0, at)}%${source.slice(at)}`;
}
