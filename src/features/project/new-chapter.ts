/**
 * New chapter (§4.6 / QA Fase 1): scaffold a chapter file and splice its
 * \input into documento.tex right after the last chapter, touching only the
 * inserted line — every other byte stays identical (same contract as
 * reorder.ts).
 *
 * Apêndices e anexos seguem a mesma disciplina, com três diferenças: a pasta,
 * o comando de abertura (`\apendice`/`\anexo`) e o bloco onde o `\input` entra
 * — logo abaixo da macro que imprime a seção. Como a seção só sai no PDF se
 * essa macro estiver ligada, o plano diz qual delas o chamador precisa ligar.
 */

import { slugify } from "@/lib/utils";

/** Matches an active (non-commented) chapter \input at line start. */
const CHAPTER_INPUT = /^([ \t]*)\\input\{elementos-textuais\/[^}]*\}/;

export type SectionTarget = "chapter" | "apendice" | "anexo";

export interface NewSectionPlan {
  /** Caminho do arquivo a criar. */
  path: string;
  /** Conteúdo inicial do arquivo. */
  content: string;
  /** `documento.tex` com o `\input` já inserido no bloco certo. */
  source: string;
  /** Macro que precisa estar ligada para a seção sair no PDF. */
  enableMacro: string | null;
}

interface TargetSpec {
  dir: string;
  command: string;
  labelPrefix: string;
  macro: string;
  /** Nome humano, para a mensagem de erro. */
  label: string;
}

const TARGETS: Record<Exclude<SectionTarget, "chapter">, TargetSpec> = {
  apendice: {
    dir: "elementos-pos-textuais/apendices",
    command: "apendice",
    labelPrefix: "ap",
    macro: "imprimirapendices",
    label: "apêndice",
  },
  anexo: {
    dir: "elementos-pos-textuais/anexos",
    command: "anexo",
    labelPrefix: "an",
    macro: "imprimiranexos",
    label: "anexo",
  },
};

export function chapterScaffold(title: string, slug: string): string {
  return `\\chapter{${title}}\n\\label{cap:${slug}}\n\n`;
}

/**
 * Inserts `\input{target}` on a new line after the LAST chapter \input,
 * reusing that line's indentation. Commented lines (%\input{...}) never
 * match — the pattern requires the line to start at \input.
 */
export function insertChapterInput(source: string, target: string): string {
  const lines = source.split("\n");
  let lastIndex = -1;
  let indent = "\t";
  for (let i = 0; i < lines.length; i++) {
    const match = CHAPTER_INPUT.exec(lines[i] ?? "");
    if (match) {
      lastIndex = i;
      indent = match[1] ?? "";
    }
  }
  if (lastIndex === -1) {
    throw new Error(
      "Nenhum capítulo (\\input{elementos-textuais/...}) encontrado no documento.tex",
    );
  }
  lines.splice(lastIndex + 1, 0, `${indent}\\input{${target}}`);
  return lines.join("\n");
}

/**
 * Insere o `\input` no bloco da seção: depois do último irmão, ou logo abaixo
 * da macro quando ainda não há nenhum. Só linhas ativas contam como âncora.
 */
function insertSectionInput(source: string, spec: TargetSpec, target: string): string {
  const lines = source.split("\n");
  const sibling = new RegExp(`^([ \\t]*)\\\\input\\{${spec.dir}/[^}]*\\}`);
  const macroLine = new RegExp(`^([ \\t]*)\\\\${spec.macro}\\b`);
  let at = -1;
  let indent = "\t\t";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const macro = macroLine.exec(line);
    if (macro) {
      at = i;
      indent = `${macro[1] ?? "\t"}\t`;
      continue;
    }
    const match = sibling.exec(line);
    if (match && at !== -1) {
      at = i;
      indent = match[1] ?? indent;
    }
  }
  if (at === -1) {
    throw new Error(
      `O documento.tex não tem a linha \\${spec.macro}; não é possível acrescentar um ${spec.label}.`,
    );
  }
  lines.splice(at + 1, 0, `${indent}\\input{${target}}`);
  return lines.join("\n");
}

/** Primeiro nome livre: `titulo`, `titulo-2`, `titulo-3`… */
function freeSlug(dir: string, title: string, taken: ReadonlySet<string>): string {
  const base = slugify(title) || "novo-capitulo";
  let slug = base;
  for (let n = 2; taken.has(`${dir}/${slug}.tex`); n++) slug = `${base}-${n}`;
  return slug;
}

/**
 * Monta o plano de criação de um capítulo, apêndice ou anexo.
 * `taken` são os caminhos já existentes no projeto — o nome do arquivo
 * ganha sufixo em vez de sobrescrever o que já existe.
 */
export function planNewSection(
  source: string,
  title: string,
  target: SectionTarget,
  taken: ReadonlySet<string> = new Set(),
): NewSectionPlan {
  if (target === "chapter") {
    const slug = freeSlug("elementos-textuais", title, taken);
    const path = `elementos-textuais/${slug}`;
    return {
      path: `${path}.tex`,
      content: chapterScaffold(title, slug),
      source: insertChapterInput(source, path),
      enableMacro: null,
    };
  }
  const spec = TARGETS[target];
  const slug = freeSlug(spec.dir, title, taken);
  const path = `${spec.dir}/${slug}`;
  return {
    path: `${path}.tex`,
    content: `\\${spec.command}{${title}}\n\\label{${spec.labelPrefix}:${slug}}\n\n`,
    source: insertSectionInput(source, spec, path),
    enableMacro: spec.macro,
  };
}
