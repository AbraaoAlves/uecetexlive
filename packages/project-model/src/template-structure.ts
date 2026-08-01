/**
 * TemplateStructure — o coração da generalização deste pacote: as regras de
 * layout de arquivos que antes eram hardcoded para o uecetex2 (§4.1) viram
 * dados que cada template institucional declara.
 */

export interface TemplateSection<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly globs: readonly string[];
}

export interface TemplateStructure<SectionId extends string = string> {
  /** Seções do rail, na ordem de precedência de match; fallback é "root". */
  readonly sections: readonly TemplateSection<SectionId>[];
  /** Globs de arquivos WYSIWYG-elegíveis (prosa que o estudante escreve). */
  readonly wysiwygEligible: readonly string[];
  /** Globs de arquivos travados em modo fonte (toggle "avançado"). */
  readonly advancedOnly: readonly string[];
  /** Além dos WYSIWYG-elegíveis, o que ainda aparece com "avançado" off. */
  readonly simpleModeVisible: readonly string[];
}

/**
 * Glob mínimo sobre paths de projeto: `**` cruza diretórios (inclusive zero),
 * `*` fica dentro de um segmento. Sem chaves/negação — as estruturas de
 * template não precisam de mais que isso.
 */
function globToRegExp(glob: string): RegExp {
  let out = "";
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        // `**/` come segmentos inteiros; `**` no fim come o resto.
        if (glob[i + 2] === "/") {
          out += "(?:[^/]+/)*";
          i += 3;
        } else {
          out += ".*";
          i += 2;
        }
      } else {
        out += "[^/]*";
        i += 1;
      }
      continue;
    }
    out += ch !== undefined && /[\w/-]/.test(ch) ? ch : `\\${ch}`;
    i += 1;
  }
  return new RegExp(`^${out}$`);
}

const regexCache = new Map<string, RegExp>();

export function matchesAnyGlob(globs: readonly string[], path: string): boolean {
  for (const glob of globs) {
    let re = regexCache.get(glob);
    if (!re) {
      re = globToRegExp(glob);
      regexCache.set(glob, re);
    }
    if (re.test(path)) return true;
  }
  return false;
}

/**
 * Estrutura do template uecetex2 — equivalente byte-a-byte ao comportamento
 * hardcoded que este pacote substitui (teste de regressão na suíte).
 */
export const UECETEX2_STRUCTURE = {
  sections: [
    {
      id: "preTextual",
      label: "Pré-textuais",
      globs: ["elementos-pre-textuais/**"],
    },
    { id: "chapters", label: "Capítulos", globs: ["elementos-textuais/**"] },
    {
      id: "postTextual",
      label: "Pós-textuais",
      globs: ["elementos-pos-textuais/**"],
    },
    { id: "library", label: "Biblioteca", globs: ["lib/**"] },
    {
      id: "figures",
      label: "Figuras",
      // figuras-extraidas/ é onde caem as imagens de um projeto vindo do
      // caminho PDF→LaTeX; sem este glob elas iam para o topo do rail.
      globs: ["figuras/**", "figuras-extraidas/**"],
    },
  ],
  wysiwygEligible: [
    "elementos-textuais/**/*.tex",
    "elementos-pos-textuais/apendices/**/*.tex",
    "elementos-pos-textuais/anexos/**/*.tex",
    "elementos-pre-textuais/resumo.tex",
    "elementos-pre-textuais/abstract.tex",
    "elementos-pre-textuais/dedicatoria.tex",
    "elementos-pre-textuais/epigrafe.tex",
    "elementos-pre-textuais/agradecimentos.tex",
  ],
  advancedOnly: ["lib/**", "documento.tex"],
  // As páginas opcionais entram aqui mesmo sem edição visual: é no painel do
  // modo simples que fica a caixinha que as inclui ou tira do PDF.
  simpleModeVisible: [
    "**/*.bib",
    "figuras/**",
    "figuras-extraidas/**",
    "elementos-pre-textuais/errata.tex",
    "elementos-pre-textuais/lista-de-abreviaturas-e-siglas.tex",
    "elementos-pre-textuais/lista-de-simbolos.tex",
    "elementos-pos-textuais/glossario.tex",
  ],
} as const satisfies TemplateStructure;

/** Ids de seção do rail para o uecetex2 (mais o fallback "root"). */
export type RailSection = "root" | (typeof UECETEX2_STRUCTURE)["sections"][number]["id"];
