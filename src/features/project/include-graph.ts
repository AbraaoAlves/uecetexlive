/**
 * Include graph (§5.3) — pure. Parses \input/\include via unified-latex
 * (comments must not count), yields ordered targets + label harvest +
 * bibliography target for the pickers.
 */
import type * as Ast from "@unified-latex/unified-latex-types";
import { parse } from "@unified-latex/unified-latex-util-parse";

export interface IncludeEntry {
  /** Raw argument as written, e.g. "elementos-textuais/introducao". */
  path: string;
  /** VFS path it resolves to (with .tex appended if needed), or null. */
  resolved: string | null;
}

export interface IncludeGraph {
  inputs: IncludeEntry[];
  labels: string[];
  bibliography: string | null;
  bibliographyStyle: string | null;
}

function flattenText(nodes: Ast.Node[]): string {
  let out = "";
  for (const node of nodes) {
    if (node.type === "string") out += node.content;
    else if (node.type === "whitespace") out += " ";
    else if (node.type === "group") out += flattenText(node.content);
  }
  return out.trim();
}

function firstArg(macro: Ast.Macro): string | null {
  const args = macro.args ?? [];
  // unified-latex may attach empty optional args; take the last non-empty.
  for (let i = args.length - 1; i >= 0; i--) {
    const arg = args[i];
    if (arg && arg.content.length > 0) return flattenText(arg.content);
  }
  return null;
}

function walk(nodes: Ast.Node[], visit: (macro: Ast.Macro) => void): void {
  for (const node of nodes) {
    if (node.type === "macro") {
      visit(node);
      for (const arg of node.args ?? []) walk(arg.content, visit);
    } else if (node.type === "environment" || node.type === "mathenv") {
      walk(node.content, visit);
    } else if (node.type === "group" || node.type === "inlinemath") {
      walk(node.content, visit);
    } else if (node.type === "root") {
      walk(node.content, visit);
    }
  }
}

function resolveTex(target: string, files: Record<string, string>): string | null {
  if (target in files) return target;
  const withExt = `${target}.tex`;
  if (withExt in files) return withExt;
  return null;
}

export function buildIncludeGraph(
  files: Record<string, string>,
  entry: string,
): IncludeGraph {
  const inputs: IncludeEntry[] = [];
  const labels: string[] = [];
  let bibliography: string | null = null;
  let bibliographyStyle: string | null = null;

  const visited = new Set<string>();

  const visitFile = (vfsPath: string, collectInputs: boolean) => {
    if (visited.has(vfsPath)) return;
    visited.add(vfsPath);
    const source = files[vfsPath];
    if (source === undefined) return;

    const ast = parse(source);
    const pendingChildren: string[] = [];

    walk(ast.content, (macro) => {
      const name = macro.content;
      if (name === "input" || name === "include") {
        const target = firstArg(macro);
        if (!target) return;
        const resolved = resolveTex(target, files);
        if (collectInputs) inputs.push({ path: target, resolved });
        if (resolved) pendingChildren.push(resolved);
      } else if (name === "label") {
        const value = firstArg(macro);
        if (value) labels.push(value);
      } else if (name === "bibliography") {
        bibliography ??= firstArg(macro);
      } else if (name === "bibliographystyle") {
        bibliographyStyle ??= firstArg(macro);
      }
    });

    // Only the entry's direct \input order defines chapter order; nested
    // files still contribute labels/bib info.
    for (const child of pendingChildren) visitFile(child, false);
  };

  visitFile(entry, true);

  return { inputs, labels, bibliography, bibliographyStyle };
}
