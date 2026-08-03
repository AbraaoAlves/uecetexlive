/**
 * Figura com legenda e fonte (3.2 — Guia UECE: "toda ilustração ... deve ter
 * ... legenda breve e a indicação obrigatória da fonte, mesmo quando
 * produzida pelo próprio autor"). Two shapes coexist in this app: the
 * editor's own WYSIWYG figures (plain \caption, never \Fonte — the ProseMirror
 * figure node has no fonte attribute) and template-authored ones
 * (\Caption + \UECEfig{}{...}{\Fonte{...}}). Same unified-latex walk as
 * include-graph.ts, scoped to `environment.env === "figure"`.
 */
import type * as Ast from "@unified-latex/unified-latex-types";
import { parse } from "@unified-latex/unified-latex-util-parse";
import { walk } from "./include-graph";

const CAPTION_MACROS = new Set(["caption", "Caption"]);
const FONTE_MACROS = new Set(["fonte", "Fonte"]);

export interface FigureCheck {
  hasCaption: boolean;
  hasFonte: boolean;
}

function containsMacro(nodes: Ast.Node[], names: Set<string>): boolean {
  let found = false;
  walk(nodes, (macro) => {
    if (names.has(macro.content)) found = true;
  });
  return found;
}

function flattenText(nodes: Ast.Node[]): string {
  let text = "";
  for (const node of nodes) {
    if (node.type === "string") text += node.content;
    else if (node.type === "whitespace") text += " ";
    else if (
      node.type === "group" ||
      node.type === "environment" ||
      node.type === "mathenv" ||
      node.type === "inlinemath" ||
      node.type === "root"
    ) {
      text += flattenText(node.content);
    } else if (node.type === "macro") {
      for (const arg of node.args ?? []) text += flattenText(arg.content);
    }
  }
  return text.trim();
}

/** Reads a braced macro argument, including unknown macros parsed with sibling groups. */
function macroArgumentText(
  siblings: Ast.Node[],
  macroIndex: number,
  argumentIndex = 0,
): string | null {
  const macro = siblings[macroIndex];
  if (macro?.type !== "macro") return null;

  const parsedArguments = (macro.args ?? []).filter(
    (argument) => argument.openMark === "{",
  );
  const parsed = parsedArguments[argumentIndex];
  if (parsed) return flattenText(parsed.content);

  let groupIndex = 0;
  for (let index = macroIndex + 1; index < siblings.length; index += 1) {
    const sibling = siblings[index];
    if (sibling.type === "whitespace" || sibling.type === "comment") continue;
    if (sibling.type !== "group") break;
    if (groupIndex === argumentIndex) return flattenText(sibling.content);
    groupIndex += 1;
  }
  return null;
}

function containsFonteLegend(nodes: Ast.Node[]): boolean {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (
      node.type === "macro" &&
      node.content === "legend" &&
      /^fontes?\b/i.test(macroArgumentText(nodes, index) ?? "")
    ) {
      return true;
    }
    if (
      node.type === "group" ||
      node.type === "environment" ||
      node.type === "mathenv" ||
      node.type === "inlinemath" ||
      node.type === "root"
    ) {
      if (containsFonteLegend(node.content)) return true;
    } else if (node.type === "macro") {
      for (const arg of node.args ?? []) {
        if (containsFonteLegend(arg.content)) return true;
      }
    }
  }
  return false;
}

function findFigureEnvironments(nodes: Ast.Node[], out: Ast.Environment[]): void {
  for (const node of nodes) {
    if (node.type === "environment" && node.env === "figure") {
      out.push(node);
    } else if (node.type === "environment" || node.type === "mathenv") {
      findFigureEnvironments(node.content, out);
    } else if (node.type === "group" || node.type === "inlinemath") {
      findFigureEnvironments(node.content, out);
    } else if (node.type === "root") {
      findFigureEnvironments(node.content, out);
    } else if (node.type === "macro") {
      for (const arg of node.args ?? []) findFigureEnvironments(arg.content, out);
    }
  }
}

/** One entry per `\begin{figure}...\end{figure}` found in the source. */
export function checkFigures(source: string): FigureCheck[] {
  let ast: Ast.Root;
  try {
    ast = parse(source);
  } catch {
    return [];
  }
  const figures: Ast.Environment[] = [];
  findFigureEnvironments(ast.content, figures);
  return figures.map((env) => ({
    hasCaption: containsMacro(env.content, CAPTION_MACROS),
    hasFonte:
      containsMacro(env.content, FONTE_MACROS) || containsFonteLegend(env.content),
  }));
}
