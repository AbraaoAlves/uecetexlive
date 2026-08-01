/**
 * Utilitários de texto compartilhados entre o emissor e o índice de citações.
 * Vivem fora do `emit.ts` para que `bibkey.ts` possa usá-los sem criar um
 * ciclo de importação com o emissor.
 */

/** Identificador estável a partir de um título ou sobrenome. */
export function slug(title: string): string {
  return title
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Marca combinante (NFD) → comando de acento do TeX. */
const ACCENT_COMMANDS: Record<string, string> = {
  "̀": "`", // grave
  "́": "'", // agudo
  "̂": "^", // circunflexo
  "̃": "~", // til
  "̄": "=", // mácron
  "̆": "u", // breve
  "̇": ".", // ponto acima
  "̈": '"', // trema
  "̊": "r", // anel
  "̋": "H", // duplo agudo
  "̌": "v", // caron
  "̧": "c", // cedilha
  "̨": "k", // ogonek
};

/** Letras sem decomposição NFD — precisam de comando próprio. */
const LETTER_COMMANDS: Record<string, string> = {
  ø: "\\o{}",
  Ø: "\\O{}",
  đ: "\\dj{}",
  Đ: "\\DJ{}",
  ł: "\\l{}",
  Ł: "\\L{}",
  ß: "\\ss{}",
  æ: "\\ae{}",
  Æ: "\\AE{}",
  œ: "\\oe{}",
  Œ: "\\OE{}",
  "–": "--",
  "—": "---",
  "“": "``",
  "”": "''",
  "‘": "`",
  "’": "'",
  "…": "\\ldots{}",
};

/**
 * Reescreve o texto em ASCII puro, com os acentos como comandos do TeX.
 *
 * É o que salva a bibliografia: o BibTeX trabalha byte a byte ao abreviar
 * prenomes e ao quebrar linhas, e corta sequências UTF-8 no meio — o `.bbl`
 * sai com bytes inválidos e a compilação para ("Invalid UTF-8 byte
 * sequence"). Acento que não sabemos nomear perde a marca, mas a letra
 * permanece: um nome sem til é melhor do que um PDF que não sai. Letra que
 * nem sequer reduz a ASCII (grego, cirílico) fica como está — apagar o nome
 * de um autor em silêncio seria pior do que um erro visível de compilação.
 *
 * Recebe texto JÁ escapado (`escapeLatex`) — os comandos que introduz não
 * podem passar pelo escape depois.
 */
export function toAsciiWithTexAccents(text: string): string {
  let out = "";
  for (const ch of text) {
    if (ch.charCodeAt(0) < 128) {
      out += ch;
      continue;
    }
    const named = LETTER_COMMANDS[ch];
    if (named !== undefined) {
      out += named;
      continue;
    }
    const [base = "", ...marks] = [...ch.normalize("NFD")];
    if (base.charCodeAt(0) >= 128) {
      out += ch; // sem redução para ASCII: preservar em vez de perder o dado
      continue;
    }
    const command = marks.map((m) => ACCENT_COMMANDS[m]).find(Boolean);
    out += command ? `{\\${command}{${base}}}` : base;
  }
  return out;
}
