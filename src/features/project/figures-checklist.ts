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
const FONTE_MACROS = new Set(["fonte", "Fonte", "Nota"]);

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
    hasFonte: containsMacro(env.content, FONTE_MACROS),
  }));
}
