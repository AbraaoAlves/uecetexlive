// Arquivo vendorado de uecetex-inverse (ab0eb48d3029b8ddce28dfd8f645afd06e9cb500) por
// scripts/vendor-inverse-core.sh. NÃO EDITE AQUI: a mudança se perde na
// próxima vendorização. Corrija na origem, que é onde ele é verificado.
// @ts-nocheck
/**
 * Stage 3 — semantic tree -> ueceTeX2-shaped LaTeX project.
 *
 * Strategy: clone the template skeleton, overwrite the content files
 * (elementos-textuais/*.tex, pre/pos-textuais, referencias.bib, figures)
 * and patch documento.tex (\titulo, \autor, textual \input block).
 *
 * Deterministic: same tree -> same bytes. The emitter produces a
 * CANONICAL representative of the source-equivalence class, not the
 * original source (compilation is not injective).
 *
 * Known v1 limitations (all marked with %% TODO in the output):
 *  - display math is emitted as a placeholder (symbolic reconstruction
 *    is a later phase);
 *  - footnote anchors reattach at paragraph granularity (the exact
 *    anchor word is not recoverable from the IR line model);
 *  - table cell wraps may surface as extra rows;
 *  - inline \cite calls are left as literal (Autor, ano) text.
 */
import type {
  BibEntry,
  BodyNode,
  FootnoteEntry,
  SemanticDoc,
  TableNode,
} from "./semantic.js";

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function escapeLatex(s: string): string {
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}])/g, "\\$1")
    .replace(/\\textbackslash\\{\\}/g, "\\textbackslash{}")
    .replace(/([#$%&_])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

import { slug, toAsciiWithTexAccents } from "./text-util.js";
export { slug };

/** Chapter titles arrive uppercased by chapter=TITLE; emit in title case
 *  for readable source (compilation re-uppercases — idempotent). */
function titleCase(t: string): string {
  const small = new Set(["e", "de", "da", "do", "das", "dos", "em", "a", "o", "as", "os", "para", "com"]);
  return t
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1)))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Node emitters
// ---------------------------------------------------------------------------

/**
 * Emite no idioma do template: ambiente `quadro`/`tabela` + `\Caption` +
 * `\UECEqua`/`\UECEtab` + `\Fonte`.
 *
 * Importa qual ambiente é usado: só `quadro` e `figure` entram na LISTA DE
 * ILUSTRAÇÕES. Emitir um Quadro como `table` o mandava para a lista de tabelas
 * — que o documento de origem não imprime — e a entrada desaparecia da lista.
 */
function emitTable(t: TableNode): string {
  const ncols = Math.max(1, ...t.rows.map((r) => r.length));
  const isQuadro = t.label === "Quadro";
  const env = isQuadro ? "quadro" : "tabela";
  const macro = isQuadro ? "UECEqua" : "UECEtab";
  const prefix = isQuadro ? "qua" : "tab";

  // Colunas `p{}` na proporção medida: `l` não quebra linha e estouraria a
  // margem em células longas como as do Quadro 1.
  const widths = t.colWidths?.length === ncols ? t.colWidths : Array(ncols).fill(1 / ncols);
  const spec = widths
    .map((w) => `p{${(w * 0.96).toFixed(4)}\\dimexpr\\textwidth-${(2 * ncols).toFixed(0)}\\tabcolsep\\relax}`)
    .join("");

  const line = (cells: string[]) =>
    [...cells, ...Array(Math.max(0, ncols - cells.length)).fill("")].map(escapeLatex).join(" & ") + " \\\\";
  const [head, ...rest] = t.rows.length ? t.rows : [[""]];
  return [
    `\\begin{${env}}[htb]`,
    `\\centering`,
    `\\Caption{\\label{${prefix}:${slug(t.caption)}} ${escapeLatex(t.caption)}}`,
    `\\${macro}{}{`,
    `\\begin{tabular}{${spec}}`,
    `\\hline`,
    line(head),
    `\\hline`,
    ...rest.flatMap((r) => [line(r), `\\hline`]),
    `\\end{tabular}`,
    `}{`,
    `\\Fonte{${escapeLatex((t.source ?? "Elaborado pelo autor").replace(/\.$/, ""))}}`,
    `}`,
    `\\end{${env}}`,
  ].join("\n");
}

/**
 * Texto com as citações já ligadas. O escape acontece POR SEGMENTO: escapar a
 * string inteira antes transformaria o comando emitido em texto literal.
 */
function emitProse(text: string, citeIndex: CiteIndex, used: Set<string>): string {
  return segmentCitations(text, citeIndex)
    .map((segment) => {
      if (segment.kind === "text") return escapeLatex(segment.value);
      if (segment.kind === "citeonline") {
        used.add(segment.key);
        return `\\citeonline{${segment.key}}`;
      }
      for (const key of segment.keys) used.add(key);
      const optional = segment.suffix ? `[${segment.suffix}]` : "";
      return `\\cite${optional}{${segment.keys.join(",")}}`;
    })
    .join("");
}

function emitNode(
  n: BodyNode,
  figDir: string,
  citeIndex: CiteIndex,
  used: Set<string>,
): string {
  switch (n.kind) {
    case "heading": {
      const cmd = { chapter: "chapter", section: "section", subsection: "subsection", subsubsection: "subsubsection" }[
        n.level
      ];
      const title = n.level === "chapter" ? titleCase(n.title) : n.title;
      const label = n.level === "chapter" ? `\n\\label{cap:${slug(n.title)}}` : `\n\\label{sec:${slug(n.title)}}`;
      return `\\${cmd}{${escapeLatex(title)}}${label}`;
    }
    case "paragraph": {
      const todo = n.hasInlineMath ? "\n%% TODO(matemática inline): revisar símbolos neste parágrafo" : "";
      return emitProse(n.text, citeIndex, used) + todo;
    }
    case "quote":
      return `\\begin{citacao}\n${emitProse(n.text, citeIndex, used)}\n\\end{citacao}`;
    case "list": {
      const env = n.style === "alpha" ? "alineas" : n.style === "numeric" ? "alineascomnumero" : "alineascomponto";
      return [`\\begin{${env}}`, ...n.items.map((i) => `\t\\item ${escapeLatex(i)}`), `\\end{${env}}`].join("\n");
    }
    case "figure": {
      const graphics = n.imageFiles.length
        ? n.imageFiles.map((f) => `\\includegraphics[width=0.75\\textwidth]{${figDir}/${f}}`).join("\n")
        : "%% TODO(figura): imagem não recuperada da IR";
      return [
        `\\begin{figure}[htb]`,
        `\\caption{${escapeLatex(n.caption)}}`,
        `\\centering`,
        graphics,
        `\\legend{Fonte: ${escapeLatex(n.source ?? "Elaborado pelo autor")}}`,
        `\\end{figure}`,
      ].join("\n");
    }
    case "table":
      return emitTable(n);
    case "displayMath":
      return [
        `%% TODO(matemática): reconstruir a partir dos glifos extraídos:`,
        ...n.raw.match(/.{1,70}/g)!.map((c) => `%%   ${c}`),
        `\\begin{equation}`,
        `\\text{[equação extraída — reconstrução simbólica pendente]}`,
        `\\end{equation}`,
      ].join("\n");
    case "code": {
      const cap = n.caption ? `[caption={${escapeLatex(n.caption)}}]` : "";
      if (n.variant === "algorithm") {
        return [
          `%% TODO(algoritmo): reconstruir marcação algorithm2e; conteúdo extraído:`,
          `\\begin{lstlisting}${cap}`,
          ...n.lines,
          `\\end{lstlisting}`,
        ].join("\n");
      }
      return [`\\begin{lstlisting}${cap}`, ...n.lines, `\\end{lstlisting}`].join("\n");
    }
  }
}

// ---------------------------------------------------------------------------
// Bibliography: ABNT text -> heuristic BibTeX
// ---------------------------------------------------------------------------

import { bibKeys } from "./bibkey.js";
import { type CiteIndex, buildCiteIndex, countUnresolved, segmentCitations } from "./cite.js";
export { bibKeys };

/**
 * Lista de autores no padrão ABNT: `SOBRENOME, I. N.` separados por `;`,
 * até o título. O ponto das iniciais não encerra a lista — cortar no
 * primeiro ". " deixava só o primeiro autor, e o estilo então renderizava
 * "(SOUSA, 2015)" onde o original traz "(Sousa; Favero, 2015)".
 */
const AUTHORS_PREFIX = new RegExp(
  String.raw`^((?:[^;.]+?,\s*(?:\p{Lu}\.\s*)+(?:et\s+al\.?\s*)?)` +
    String.raw`(?:;\s*[^;.]+?,\s*(?:\p{Lu}\.\s*)+(?:et\s+al\.?\s*)?)*)`,
  "u",
);

export function authorsOf(raw: string): string {
  // Sem o padrão de iniciais (autor corporativo, "GITHUB, INC."), volta ao
  // corte no primeiro ponto — pior, mas melhor do que perder o autor.
  const prefix = AUTHORS_PREFIX.exec(raw)?.[1] ?? /^(.*?)\. /.exec(raw)?.[1];
  if (!prefix) return "";
  const names: string[] = [];
  let abbreviated = false;
  for (const part of prefix.split(";")) {
    const name = part.replace(/\bet\s+al\.?/iu, () => ((abbreviated = true), "")).trim();
    if (name) names.push(name);
  }
  // "and others" é como o BibTeX escreve "et al." — a lista de referências do
  // PDF de origem já vinha abreviada, não há como recuperar os demais nomes.
  if (abbreviated) names.push("others");
  return names.join(" and ");
}

export function emitBib(entries: BibEntry[]): string {
  const keys = bibKeys(entries);
  const out: string[] = [
    "%% Gerado por uecetex-inverse — entradas reconstruídas heuristicamente",
    "%% do texto ABNT; revisar campos antes do uso definitivo.",
    "",
  ];
  for (const [i, e] of entries.entries()) {
    const key = keys[i] as string;
    const authors = authorsOf(e.raw);
    const title = e.emphasized.length ? e.emphasized.join(" ").replace(/\.\s*$/, "") : undefined;
    const year = /\b(1[89]\d\d|20\d\d)\b/.exec(e.raw)?.[1];
    // escapeLatex em TODO campo, não só em `note`: um "&" cru em `title`
    // ("… Engineering & Technology") aborta a compilação com
    // "Misplaced alignment tab character &".
    // ASCII puro em TODO campo: o BibTeX abrevia prenomes e quebra linhas
    // byte a byte, cortando sequências UTF-8 no meio (I.3-T4).
    const field = (value: string) => toAsciiWithTexAccents(escapeLatex(value));
    out.push(`@misc{${key},`);
    if (authors) out.push(`  author = {${field(authors)}},`);
    if (title) out.push(`  title = {${field(title)}},`);
    if (year) out.push(`  year = {${year}},`);
    out.push(`  note = {${field(e.raw.replace(/[{}]/g, ""))}},`);
    out.push(`}`, "");
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Project assembly
// ---------------------------------------------------------------------------

const PRETEXTUAL_FILES: Record<string, string> = {
  RESUMO: "elementos-pre-textuais/resumo.tex",
  ABSTRACT: "elementos-pre-textuais/abstract.tex",
  AGRADECIMENTOS: "elementos-pre-textuais/agradecimentos.tex",
};

/**
 * Macro de palavras-chave por seção. O consumidor (uecetexlive) procura
 * `\\palavraschave` em resumo.tex e `\\keywords` em abstract.tex, e trata como
 * corpo tudo que vier antes dela.
 */
const KW_MACRO: Record<string, string> = {
  RESUMO: "palavraschave",
  ABSTRACT: "keywords",
};

/**
 * Corpo em prosa + a macro de palavras-chave no fim, e nada depois dela.
 *
 * O rótulo pode chegar embutido no fim de um parágrafo: no PDF ele começa na
 * margem esquerda, sem recuo, e o classificador só abre parágrafo novo com
 * recuo. O `m.index > 0` cobre esse caso.
 */
export function emitPretextual(title: string, paragraphs: string[]): string {
  const macro = KW_MACRO[title] ?? "palavraschave";
  const body: string[] = [];
  let keywords: string | null = null;
  for (const p of paragraphs) {
    const m = /(Palavras-chave|Keywords)\s*:\s*/.exec(p);
    if (m) {
      const before = p.slice(0, m.index).trim();
      if (before) body.push(escapeLatex(before), "");
      keywords = p.slice(m.index + m[0].length).trim();
    } else body.push(escapeLatex(p), "");
  }
  const out = body.join("\n").trim();
  return keywords !== null
    ? `${out}\n\n\\${macro}{${escapeLatex(keywords)}}\n`
    : `${out}\n`;
}

/** Relatório honesto do que foi reconhecido e do que ficou pendente. */
export interface EmitReport {
  chapters: number;
  figures: number;
  tables: number;
  listItems: number;
  codeBlocks: number;
  bibEntries: number;
  citations: { linked: number; literal: number };
  /** Títulos pré-textuais reconhecidos (RESUMO, ABSTRACT…). */
  pretextuais: string[];
  pendencias: Array<{
    kind:
      | "equacao"
      | "nota-rodape"
      | "citacao-nao-ligada"
      | "nao-classificado"
      | "figura-sem-imagem";
    /** 1-based. */
    page: number;
    /** ≤ 80 caracteres. */
    excerpt: string;
  }>;
}

export interface EmitFilesOptions {
  /** Esqueleto do modelo: caminho relativo → bytes. */
  template: ReadonlyMap<string, Uint8Array>;
  /** Figuras exportadas pelo estágio 1: nome → bytes do PNG. */
  assets?: ReadonlyMap<string, Uint8Array>;
}

export interface EmitFilesResult {
  /** Projeto completo em memória: caminho relativo → bytes. */
  files: Map<string, Uint8Array>;
  report: EmitReport;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Diretórios cujo conteúdo `.tex` o emissor possui e substitui por inteiro. */
const OWNED_DIRS = [
  "elementos-textuais",
  "elementos-pos-textuais/apendices",
  "elementos-pos-textuais/anexos",
];

const excerptOf = (text: string) =>
  text.length <= 80 ? text : `${text.slice(0, 77)}...`;

/**
 * Estágio 3, puro: árvore semântica + esqueleto do modelo → projeto em
 * memória. Sem `node:fs` — é o que permite rodar o mesmo emissor no CLI e no
 * navegador. Quem grava em disco é o chamador.
 */
export function emitFiles(sem: SemanticDoc, opts: EmitFilesOptions): EmitFilesResult {
  const files = new Map<string, Uint8Array>(opts.template);
  const w = (rel: string, content: string) => files.set(rel, encoder.encode(content));

  // 1) o conteúdo que o emissor possui sai do esqueleto — capítulo velho do
  // modelo ficaria inerte ao lado do emitido.
  for (const rel of [...files.keys()]) {
    if (!rel.endsWith(".tex")) continue;
    if (OWNED_DIRS.some((dir) => rel.startsWith(`${dir}/`))) files.delete(rel);
  }

  const pendencias: EmitReport["pendencias"] = [];

  // 2) figuras
  const figDir = "figuras-extraidas";
  const usedImages = new Set<string>();
  let figures = 0;
  for (const n of sem.body) {
    if (n.kind !== "figure") continue;
    figures++;
    if (n.imageFiles.length === 0) {
      pendencias.push({
        kind: "figura-sem-imagem",
        page: n.page + 1,
        excerpt: excerptOf(n.caption),
      });
    }
    for (const f of n.imageFiles) usedImages.add(f);
  }
  for (const f of [...usedImages].sort()) {
    const bytes = opts.assets?.get(f);
    if (bytes) files.set(`${figDir}/${f}`, bytes);
  }

  // 3) capítulos -> elementos-textuais/<slug>.tex
  const citeIndex = buildCiteIndex(sem.bibliography);
  const citedKeys = new Set<string>();
  let literalCitations = 0;
  let tables = 0;
  let listItems = 0;
  let codeBlocks = 0;
  const chapters: { slugName: string; parts: string[]; pages: Set<number> }[] = [];
  // Dois capítulos com o mesmo título — ou títulos que reduzem ao mesmo nome —
  // sobrescreveriam um ao outro e o documento incluiria o sobrevivente duas
  // vezes, perdendo um capítulo inteiro em silêncio.
  const usedSlugs = new Set<string>();
  for (const n of sem.body) {
    if (n.kind === "heading" && n.level === "chapter") {
      if (!n.numbered) break; // REFERÊNCIAS ends the textual flow
      const base = slug(n.title) || "capitulo";
      let slugName = base;
      for (let i = 2; usedSlugs.has(slugName); i++) slugName = `${base}-${i}`;
      usedSlugs.add(slugName);
      chapters.push({ slugName, parts: [], pages: new Set() });
    }
    const cur = chapters[chapters.length - 1];
    if (!cur) continue;
    if (n.kind === "table") tables++;
    if (n.kind === "list") listItems += n.items.length;
    if (n.kind === "code") codeBlocks++;
    if (n.kind === "paragraph" || n.kind === "quote") {
      const unresolved = countUnresolved(n.text, citeIndex);
      literalCitations += unresolved;
      if (unresolved > 0) {
        pendencias.push({
          kind: "citacao-nao-ligada",
          page: n.page + 1,
          excerpt: excerptOf(n.text),
        });
      }
      if (n.kind === "paragraph" && n.hasInlineMath) {
        pendencias.push({
          kind: "equacao",
          page: n.page + 1,
          excerpt: excerptOf(n.text),
        });
      }
    }
    cur.parts.push(emitNode(n, figDir, citeIndex, citedKeys));
    cur.pages.add(n.page);
  }

  // footnotes reattach at paragraph granularity: append to the last
  // paragraph emitted for the footnote's page
  const pendingNotes = [...sem.footnotes];
  for (const ch of chapters) {
    for (const note of pendingNotes.filter((f) => ch.pages.has(f.page))) {
      pendencias.push({
        kind: "nota-rodape",
        page: note.page + 1,
        excerpt: excerptOf(note.text),
      });
      for (let i = ch.parts.length - 1; i >= 0; i--) {
        if (!ch.parts[i].startsWith("\\") && !ch.parts[i].startsWith("%")) {
          ch.parts[i] +=
            `\\footnote{${escapeLatex(note.text)}}` +
            ` %% TODO(nota ${note.marker}): reancorar na palavra exata (p${note.page + 1})`;
          break;
        }
      }
    }
  }
  // \nocite só para o que ficou sem citação no texto: sem isso a bibliografia
  // não listaria as entradas que o autor citou mas não conseguimos ligar.
  const uncited = bibKeys(sem.bibliography).filter((k) => !citedKeys.has(k));
  if (uncited.length)
    chapters[chapters.length - 1]?.parts.push(
      "",
      `\\nocite{${uncited.join(",")}} % referências não citadas no texto reconstruído`,
    );

  for (const ch of chapters) w(`elementos-textuais/${ch.slugName}.tex`, ch.parts.join("\n\n") + "\n");

  // 4) pré-textuais
  const pretextuais: string[] = [];
  for (const p of sem.pretextual) {
    const file = PRETEXTUAL_FILES[p.title];
    if (!file) continue;
    pretextuais.push(p.title);
    w(file, emitPretextual(p.title, p.paragraphs));
  }

  // 5) pós-textuais apêndices/anexos
  const apInputs: string[] = [];
  const anInputs: string[] = [];
  for (const p of sem.posttextual) {
    const m = /^(APÊNDICE|ANEXO) [A-Z] ?[–—-] ?(.*)$/.exec(p.title);
    if (!m) continue;
    const rel = `elementos-pos-textuais/${m[1] === "APÊNDICE" ? "apendices" : "anexos"}/${slug(m[2])}.tex`;
    const body = [`\\chapter{${escapeLatex(titleCase(m[2]))}}`, "", ...p.paragraphs.map(escapeLatex)].join("\n") + "\n";
    w(rel, body);
    (m[1] === "APÊNDICE" ? apInputs : anInputs).push(`\t\t\\input{${rel.replace(/\.tex$/, "")}}`);
  }

  // 6) bibliografia
  w("elementos-pos-textuais/referencias.bib", emitBib(sem.bibliography));

  // 7) documento.tex
  const docBytes = files.get("documento.tex");
  if (!docBytes) throw new Error("O modelo não tem documento.tex");
  let doc = decoder.decode(docBytes);
  doc = patchFrontMatter(doc, sem);

  const textualInputs = chapters.map((c) => `\t\\input{elementos-textuais/${c.slugName}}`).join("\n");
  doc = doc.replace(/(\t\\input\{elementos-textuais\/[^}]+\}\n?)+/, textualInputs + "\n");

  // Apêndices e anexos: substitui os \input do template pelos emitidos —
  // e REMOVE os do template quando não há substituto. O passo 1 já apagou os
  // .tex correspondentes, então deixá-los era `Emergency stop` garantido em
  // qualquer documento sem apêndice nem anexo (o caso comum).
  doc = replaceOrDrop(doc, /(\t\t\\input\{elementos-pos-textuais\/apendices\/[^}]+\}[ \t]*\n)+/, apInputs);
  doc = replaceOrDrop(doc, /(\t\t\\input\{elementos-pos-textuais\/anexos\/[^}]+\}[ \t]*\n)+/, anInputs);
  doc = pruneFrontMatterCommands(doc, sem, apInputs.length > 0, anInputs.length > 0);
  w("documento.tex", doc);

  for (const line of sem.unclassified ?? []) {
    pendencias.push({
      kind: "nao-classificado",
      page: line.page + 1,
      excerpt: excerptOf(line.text),
    });
  }

  return {
    files,
    report: {
      chapters: chapters.length,
      figures,
      tables,
      listItems,
      codeBlocks,
      bibEntries: sem.bibliography.length,
      citations: { linked: citedKeys.size, literal: literalCitations },
      pretextuais,
      pendencias,
    },
  };
}

/** Troca um bloco de \input pelos emitidos; sem substitutos, apaga o bloco. */
function replaceOrDrop(doc: string, block: RegExp, lines: string[]): string {
  return doc.replace(block, lines.length ? lines.join("\n") + "\n" : "");
}

/**
 * Configura o `documento.tex` com os dados lidos da capa, folha de rosto e
 * folha de aprovação. Sem isso o PDF gerado sai com a capa do template
 * (dissertação em Fortaleza, 2017, orientador "Nome do seu Orientador").
 */
/** Todos os tipos que o modelo aceita, com o que a folha de rosto diz de cada um. */
const WORK_TYPE_PATTERNS: [RegExp, string][] = [
  [/^Tese\b|Tese apresentada|grau de Doutor/i, "tese"],
  [/^Disserta[çc][ãa]o\b|Disserta[çc][ãa]o apresentada|grau de Mestre/i, "dissertacao"],
  [/Curso de Especializa[çc][ãa]o|Especializa[çc][ãa]o em/i, "tccespecializacao"],
  [/^Trabalho de Conclus[ãa]o de Curso/i, "tccgraduacao"],
];

/** Tipo declarado na folha de rosto, ou `null` quando não dá para dizer. */
export function workTypeFromPreamble(preamble: string): string | null {
  for (const [pattern, type] of WORK_TYPE_PATTERNS) {
    if (pattern.test(preamble)) return type;
  }
  return null;
}

/**
 * Deixa ativa só a linha do tipo escolhido — as quatro convivem no modelo,
 * três comentadas. Sem isso, um PDF de tese saía configurado como
 * dissertação (a linha ativa do template), com a capa e a folha de aprovação
 * erradas.
 */
export function selectWorkType(doc: string, workType: string): string {
  let out = doc.replace(
    new RegExp(`^%*\\s*\\\\trabalhoacademico\\{${workType}\\}`, "m"),
    `\\trabalhoacademico{${workType}}`,
  );
  for (const other of ["tccgraduacao", "tccespecializacao", "dissertacao", "tese"]) {
    if (other === workType) continue;
    out = out.replace(
      new RegExp(`^\\\\trabalhoacademico\\{${other}\\}`, "m"),
      `%\\trabalhoacademico{${other}}`,
    );
  }
  return out;
}

function patchFrontMatter(doc: string, sem: SemanticDoc): string {
  const fm = sem.frontMatter;
  // Ancorado em início de linha: o template traz exemplos COMENTADOS
  // ("% \membrodabancadois{Prof. Dr. Fulano de Tal}") antes da definição real,
  // e um regex solto substituía o comentário e deixava o valor de verdade.
  const set = (cmd: string, value: string) => {
    const re = new RegExp(`^\\\\${cmd}\\{[^}]*\\}`, "m");
    if (re.test(doc)) doc = doc.replace(re, `\\${cmd}{${value}}`);
  };

  if (sem.metadata.title) set("titulo", escapeLatex(sem.metadata.title));
  if (sem.metadata.author) set("autor", escapeLatex(sem.metadata.author));
  if (fm.year) set("data", fm.year);
  if (fm.city) set("local", cityToLatex(fm.city));

  // Natureza do trabalho: o texto da folha de rosto diz o tipo, o curso, a
  // habilitação e se há vínculo UAB. Tudo isso é configuração do template.
  const pre = fm.preamble ?? "";
  const workType = workTypeFromPreamble(pre);
  // Só `selectWorkType`: um `set` aqui reescreveria a linha ATIVA (a do
  // modelo, dissertação) e deixaria duas linhas ativas do mesmo comando.
  if (workType) doc = selectWorkType(doc, workType);
  // Qualificação: o preâmbulo diz "Exame de Qualificação" / "de qualificação".
  if (/\bqualifica[çc][ãa]o\b/i.test(pre)) set("ehqualificacao", "sim");
  const course = /Curso de Graduação em (.+?) do (?:Centro|Instituto|Faculdade)/.exec(pre)?.[1];
  if (course) set("graduacaoem", escapeLatex(course));
  const degree = /obtenção do grau de (\w+)/.exec(pre)?.[1];
  if (degree) set("habilitacao", degree);
  set("ehuab", /Universidade Aberta do Brasil/.test(pre) || fm.institutionLines.some((l) => /ABERTA DO BRASIL/.test(l)) ? "sim" : "nao");
  const centro = fm.institutionLines.find((l) => /^CENTRO |^INSTITUTO |^FACULDADE /.test(l));
  if (centro) set("centro", escapeLatex(titleCaseInstitution(centro)));

  // Orientador e banca. O 1º membro da folha de aprovação é o orientador; os
  // demais preenchem \membrodabancadois em diante (a numeração do template
  // conta o orientador como "um").
  if (fm.advisor) set("orientador", escapeLatex(fm.advisor));
  const advisorEntry = fm.board[0];
  if (advisorEntry?.center) set("orientadorcentro", escapeLatex(advisorEntry.center));
  if (advisorEntry?.ies) set("orientadories", escapeLatex(advisorEntry.ies));
  const ORDINALS = ["dois", "tres", "quatro", "cinco", "seis"];
  for (let i = 0; i < ORDINALS.length; i++) {
    const m = fm.board[i + 1];
    const o = ORDINALS[i];
    // Nome vazio remove o membro da folha de aprovação (contrato do template).
    set(`membrodabanca${o}`, m ? escapeLatex(m.name) : "");
    set(`membrodabanca${o}centro`, m?.center ? escapeLatex(m.center) : "");
    set(`membrodabanca${o}ies`, m?.ies ? escapeLatex(m.ies) : "");
  }
  return doc;
}

/**
 * Comenta os `\imprimir*` de elementos que o documento de origem não tem.
 *
 * O template dispara errata, dedicatória, agradecimentos, epígrafe, cinco
 * listas, glossário e índice sem condição alguma. Um TCC que não usa nada disso
 * ganhava ~6 páginas de placeholder que o original não tem — e o `\imprimirindice`
 * ainda puxava um índice vazio.
 */
function pruneFrontMatterCommands(doc: string, sem: SemanticDoc, hasAp: boolean, hasAn: boolean): string {
  const has = (title: string) =>
    sem.pretextual.some((p) => p.title === title) || sem.posttextual.some((p) => p.title === title);
  const fm = sem.frontMatter;
  const keep: Record<string, boolean> = {
    imprimirerrata: has("ERRATA"),
    imprimirdedicatoria: has("DEDICATÓRIA"),
    imprimiragradecimentos: has("AGRADECIMENTOS"),
    imprimirepigrafe: has("EPÍGRAFE"),
    imprimirfichacatalografica: fm.has.catalogCard,
    imprimirfolhadeaprovacao: fm.has.approvalSheet,
    imprimirlistadeilustracoes: fm.has.illustrationList,
    imprimirlistadetabelas: fm.has.tableList,
    imprimirlistadequadros: false,
    imprimirlistadealgoritmos: sem.body.some((n) => n.kind === "code" && n.variant === "algorithm"),
    imprimirlistadecodigosfonte: sem.body.some((n) => n.kind === "code" && n.variant === "listing"),
    imprimirlistadeabreviaturasesiglas: fm.has.abbreviationList,
    imprimirlistadesimbolos: fm.has.symbolList,
    imprimirglossario: has("GLOSSÁRIO"),
    imprimirapendices: hasAp,
    imprimiranexos: hasAn,
    imprimirindice: has("ÍNDICE"),
  };
  for (const [cmd, wanted] of Object.entries(keep)) {
    if (wanted) continue;
    // Só comenta linhas cujo conteúdo é exatamente o comando (com argumento
    // opcional), preservando indentação — nunca toca em texto de capítulo.
    doc = doc.replace(new RegExp(`^([ \\t]*)(\\\\${cmd}(?:\\{[^}]*\\})?[ \\t]*)$`, "gm"), "$1%$2");
  }
  return doc;
}

/** "CAUCAIA – CEARÁ" -> "Caucaia -- Ceará" (o template aplica MakeUppercase). */
function cityToLatex(city: string): string {
  return city
    .split(/\s*[–—-]\s*/)
    .map((part) => titleCaseInstitution(part))
    .join(" -- ");
}

/** Caixa alta -> caixa mista preservando preposições. */
function titleCaseInstitution(s: string): string {
  const small = new Set(["e", "de", "da", "do", "das", "dos", "em", "a", "o", "as", "os"]);
  return s
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1)))
    .join(" ");
}
