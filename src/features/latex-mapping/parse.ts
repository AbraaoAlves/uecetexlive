/**
 * LaTeX → PM-JSON (§4.3). Never throws: worst case = one big rawLatex.
 *
 * Fidelity machinery (risk K4 — the invariant defines the whitelist):
 *  - Text content is sliced from the source by AST positions, so exotic
 *    whitespace rides along byte-exact.
 *  - Every promoted construct is verified: its serialization must reproduce
 *    the exact source slice; on mismatch the construct keeps its structure
 *    but caches `rawSource` (serialize emits it verbatim until the editor
 *    modifies the node), or falls all the way back to rawLatex.
 *  - A final whole-document verify falls back to the degenerate one-block
 *    rawLatex mapping, making Invariant #1 unconditional.
 */
import type * as Ast from "@unified-latex/unified-latex-types";
import { parse as unifiedParse } from "@unified-latex/unified-latex-util-parse";
import { serializeBlock, serializeDoc, serializeInline } from "./serialize";
import { sliceArgs } from "./slice-args";
import type { ParseResult, PMDoc, PMNode } from "./types";

const HEADING_CMDS: Record<string, number> = {
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
};

const MARK_CMDS: Record<string, { type: string }> = {
  textbf: { type: "bold" },
  textit: { type: "italic" },
  emph: { type: "italic" },
  underline: { type: "underline" },
  texttt: { type: "code" },
};

const CITE_CMDS = new Set(["cite", "citeonline", "Citeonline", "citep", "citet"]);
const CROSSREF_CMDS = new Set(["ref", "autoref", "pageref"]);
/** Escape macros whose content is a literal character. */
const ESCAPE_CHARS = new Set(["%", "&", "#", "_", "$", "{", "}"]);

type Node = Ast.Node;

function offsetOf(node: Node, edge: "start" | "end"): number | null {
  const pos = (
    node as { position?: { start: { offset: number }; end: { offset: number } } }
  ).position;
  if (!pos) return null;
  return edge === "start" ? pos.start.offset : pos.end.offset;
}

/**
 * unified-latex macro positions cover ONLY the macro name — attached args
 * carry their own positions. The true end of a node is the max across its
 * own position and every descendant argument's content.
 */
function endOffsetDeep(node: Node): number | null {
  let end = offsetOf(node, "end");
  const args = (node as { args?: Ast.Argument[] }).args;
  if (args) {
    for (const arg of args) {
      let inner: number | null = null;
      for (const child of arg.content) {
        const childEnd = endOffsetDeep(child);
        if (childEnd !== null && (inner === null || childEnd > inner)) inner = childEnd;
      }
      // Content positions exclude the arg's delimiters; add the closeMark.
      if (inner !== null) {
        const withClose = inner + (arg.closeMark?.length ?? 0);
        if (end === null || withClose > end) end = withClose;
      }
    }
  }
  return end;
}

function lineOf(node: Node): number | undefined {
  const pos = (node as { position?: { start: { line: number } } }).position;
  return pos?.start.line;
}

function degenerate(source: string): ParseResult {
  const doc: PMDoc = {
    type: "doc",
    content:
      source === ""
        ? []
        : [
            {
              type: "rawLatexBlock",
              attrs: { gapBefore: "" },
              content: [{ type: "text", text: source }],
            },
          ],
  };
  (doc as unknown as { attrs: Record<string, unknown> }).attrs = { gapAfter: "" };
  return { doc };
}

// ---------------------------------------------------------------------------
// Block segmentation
// ---------------------------------------------------------------------------

function isHeadingMacro(node: Node): boolean {
  return node.type === "macro" && node.content in HEADING_CMDS;
}

function isBlockSolo(node: Node): boolean {
  if (node.type === "environment" || node.type === "mathenv") return true;
  if (node.type === "verbatim") return true;
  if (node.type === "displaymath") return true;
  if (isHeadingMacro(node)) return true;
  if (node.type === "macro" && node.content === "lstinputlisting") return true;
  return false;
}

function segmentBlocks(nodes: Node[]): Node[][] {
  const segments: Node[][] = [];
  let run: Node[] = [];

  const closeRun = () => {
    while (run.length > 0 && run[run.length - 1]?.type === "whitespace") run.pop();
    if (run.length > 0) segments.push(run);
    run = [];
  };

  for (const node of nodes) {
    if (node.type === "parbreak") {
      closeRun();
      continue;
    }
    if (node.type === "whitespace" && run.length === 0) continue;
    if (isBlockSolo(node)) {
      closeRun();
      segments.push([node]);
      continue;
    }
    if (node.type === "comment" && run.length === 0) {
      // Own-line comment forms its own block; a trailing same-line comment
      // stays inside the run (handled by inline slicing).
      segments.push([node]);
      continue;
    }
    run.push(node);
  }
  closeRun();
  return segments;
}

function segmentRange(seg: Node[]): [number, number] | null {
  const firstNode = seg[0];
  const lastNode = seg[seg.length - 1];
  if (!firstNode || !lastNode) return null;
  const start = offsetOf(firstNode, "start");
  const end = endOffsetDeep(lastNode);
  if (start === null || end === null) return null;
  return [start, end];
}

// ---------------------------------------------------------------------------
// Inline promotion
// ---------------------------------------------------------------------------

function _flattenArgText(nodes: Node[]): string {
  let out = "";
  for (const node of nodes) {
    if (node.type === "string") out += node.content;
    else if (node.type === "whitespace") out += " ";
    else if (node.type === "group") out += _flattenArgText(node.content);
  }
  return out;
}

interface InlineCtx {
  source: string;
}

/** Consume nodes[i…] as one inline element; returns [pmNodes, nextIndex, endOffset]. */
function promoteInlineAt(
  nodes: Node[],
  i: number,
  ctx: InlineCtx,
): [PMNode[], number, number] | null {
  const node = nodes[i];
  if (!node) return null;
  const start = offsetOf(node, "start");
  const end = offsetOf(node, "end");
  if (start === null || end === null) return null;
  const { source } = ctx;

  if (node.type === "string" || node.type === "whitespace") {
    return [[{ type: "text", text: source.slice(start, end) }], i + 1, end];
  }

  if (node.type === "comment") {
    return [
      [{ type: "rawLatexInline", attrs: { latex: source.slice(start, end) } }],
      i + 1,
      end,
    ];
  }

  if (node.type === "inlinemath") {
    const slice = source.slice(start, end);
    let candidate: PMNode;
    if (slice.startsWith("$") && slice.endsWith("$")) {
      candidate = {
        type: "mathInline",
        attrs: { tex: slice.slice(1, -1), delim: "dollar" },
      };
    } else if (slice.startsWith("\\(") && slice.endsWith("\\)")) {
      candidate = {
        type: "mathInline",
        attrs: { tex: slice.slice(2, -2), delim: "paren" },
      };
    } else {
      candidate = { type: "rawLatexInline", attrs: { latex: slice } };
    }
    if (serializeInline(candidate) !== slice) {
      candidate = { type: "rawLatexInline", attrs: { latex: slice } };
    }
    return [[candidate], i + 1, end];
  }

  if (node.type === "macro") {
    const name = node.content;

    // Escaped literal characters: \% \& \_ …
    if (ESCAPE_CHARS.has(name)) {
      return [[{ type: "text", text: name }], i + 1, end];
    }

    // Marks: \textbf{…} etc.
    const mark = MARK_CMDS[name];
    if (mark) {
      const result = promoteMarkMacro(node, mark.type, name, ctx);
      if (result) return [[result.node], i + 1, result.end];
      return [
        [{ type: "rawLatexInline", attrs: { latex: source.slice(start, end) } }],
        i + 1,
        end,
      ];
    }

    // Citations / crossrefs / footnote: args may or may not be attached by
    // unified-latex; slice them from source either way.
    if (CITE_CMDS.has(name) || CROSSREF_CMDS.has(name) || name === "footnote") {
      const nameEnd = start + 1 + name.length;
      const args = sliceArgs(source, nameEnd, true);
      if (args?.mandatory !== null && args !== null) {
        const fullEnd = args.end;
        const slice = source.slice(start, fullEnd);
        let candidate: PMNode;
        if (CITE_CMDS.has(name)) {
          candidate = {
            type: "citation",
            attrs: {
              cmd: name,
              keys: args.mandatory.split(",").map((k) => k.trim()),
              opt: args.opt,
            },
          };
        } else if (CROSSREF_CMDS.has(name)) {
          candidate = {
            type: "crossref",
            attrs: { cmd: name, target: args.mandatory },
          };
        } else {
          candidate = { type: "footnote", attrs: { latex: args.mandatory } };
        }
        if (serializeInline(candidate) !== slice) {
          candidate.attrs = { ...candidate.attrs, rawSource: slice };
        }
        // Skip any following nodes swallowed by the slice (unattached args).
        let next = i + 1;
        while (next < nodes.length) {
          const peek = nodes[next];
          const peekEnd = peek ? offsetOf(peek, "end") : null;
          if (peek && peekEnd !== null && peekEnd <= fullEnd) next++;
          else break;
        }
        return [[candidate], next, fullEnd];
      }
    }

    // Unknown macro → rawLatexInline over its full range including any
    // attached args (endOffsetDeep); unattached groups stay separate and
    // ride as their own raw slices.
    const deepEnd = endOffsetDeep(node) ?? end;
    return [
      [{ type: "rawLatexInline", attrs: { latex: source.slice(start, deepEnd) } }],
      i + 1,
      deepEnd,
    ];
  }

  // Groups and anything else: raw slice.
  return [
    [{ type: "rawLatexInline", attrs: { latex: source.slice(start, end) } }],
    i + 1,
    end,
  ];
}

function promoteMarkMacro(
  node: Ast.Macro,
  markType: string,
  cmd: string,
  ctx: InlineCtx,
): { node: PMNode; end: number } | null {
  const start = offsetOf(node, "start");
  const end = endOffsetDeep(node);
  if (start === null || end === null) return null;
  const args = node.args ?? [];
  const arg = args[args.length - 1];
  if (!arg || args.length !== 1) return null;

  const children = promoteInlines(arg.content, ctx);
  if (!children) return null;

  const markedChildren: PMNode[] = [];
  for (const child of children) {
    if (child.type !== "text") return null; // marks over atoms → raw fallback
    markedChildren.push({
      ...child,
      marks: [{ type: markType, attrs: { cmd } }, ...(child.marks ?? [])],
    });
  }

  const candidate: PMNode = { type: "text", text: "" };
  // Merge into a single marked text node when possible, else keep pieces.
  const merged =
    markedChildren.length === 1
      ? markedChildren
      : (() => {
          const sameMarks = markedChildren.every(
            (c) => JSON.stringify(c.marks) === JSON.stringify(markedChildren[0]?.marks),
          );
          if (!sameMarks) return markedChildren;
          return [
            {
              type: "text",
              text: markedChildren.map((c) => c.text).join(""),
              marks: markedChildren[0]?.marks,
            } as PMNode,
          ];
        })();

  const slice = ctx.source.slice(start, end);
  const serialized = merged.map(serializeInline).join("");
  if (serialized !== slice) return null;
  void candidate;
  return merged.length === 1 && merged[0]
    ? { node: merged[0], end }
    : { node: { type: "rawLatexInline", attrs: { latex: slice } }, end };
}

function promoteInlines(nodes: Node[], ctx: InlineCtx): PMNode[] | null {
  const out: PMNode[] = [];
  let i = 0;
  let lastEnd: number | null = null;

  while (i < nodes.length) {
    const node = nodes[i];
    if (!node) return null;
    const start = offsetOf(node, "start");
    if (start === null) return null;
    // Preserve any gap between consecutive inline nodes byte-exact.
    if (lastEnd !== null && start > lastEnd) {
      out.push({ type: "text", text: ctx.source.slice(lastEnd, start) });
    }
    const step = promoteInlineAt(nodes, i, ctx);
    if (!step) return null;
    const [pmNodes, next, endOffset] = step;
    out.push(...pmNodes);
    i = next;
    lastEnd = endOffset;
  }

  // Merge adjacent unmarked text nodes.
  const merged: PMNode[] = [];
  for (const node of out) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.type === "text" &&
      node.type === "text" &&
      !prev.marks &&
      !node.marks
    ) {
      prev.text = (prev.text ?? "") + (node.text ?? "");
    } else {
      merged.push(node);
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Block promotion
// ---------------------------------------------------------------------------

function rawBlock(slice: string): PMNode {
  return {
    type: "rawLatexBlock",
    content: slice === "" ? [] : [{ type: "text", text: slice }],
  };
}

function withVerify(candidate: PMNode, slice: string, cacheRawSource: boolean): PMNode {
  if (serializeBlock(candidate) === slice) return candidate;
  if (cacheRawSource) {
    return { ...candidate, attrs: { ...candidate.attrs, rawSource: slice } };
  }
  return rawBlock(slice);
}

function promoteHeading(macro: Ast.Macro, slice: string, ctx: InlineCtx): PMNode {
  const cmd = macro.content;
  const level = HEADING_CMDS[cmd];
  const starred = slice.startsWith(`\\${cmd}*`);
  const nameEnd = (offsetOf(macro, "start") ?? 0) + 1 + cmd.length + (starred ? 1 : 0);
  const args = sliceArgs(ctx.source, nameEnd, true);
  if (!args || args.mandatory === null) return rawBlock(slice);
  // Optional short-title arg would break canonical serialize → raw fallback.
  const argStart = nameEnd + (args.opt !== null ? args.opt.length + 2 : 0) + 1;
  const inner = promoteInlinesOfRange(ctx, argStart, argStart + args.mandatory.length);
  if (!inner) return rawBlock(slice);
  const candidate: PMNode = {
    type: "heading",
    attrs: { level, cmd, starred },
    content: inner,
  };
  return withVerify(candidate, slice, false);
}

/** Re-parse a sub-range of the source as inline content. */
function promoteInlinesOfRange(
  ctx: InlineCtx,
  start: number,
  end: number,
): PMNode[] | null {
  const sub = ctx.source.slice(start, end);
  let ast: Ast.Root;
  try {
    ast = unifiedParse(sub);
  } catch {
    return null;
  }
  const subCtx: InlineCtx = { source: sub };
  const inner = promoteInlines(ast.content, subCtx);
  return inner;
}

function splitListItems(content: Node[]): Node[][] | null {
  // unified-latex attaches each \item's content as the macro's last
  // argument; siblings between items are only whitespace/parbreaks.
  const items: Node[][] = [];
  for (const node of content) {
    if (node.type === "macro" && node.content === "item") {
      const args = node.args ?? [];
      const contentArg = [...args].reverse().find((a) => a.content.length > 0);
      items.push(contentArg ? [...contentArg.content] : []);
      continue;
    }
    if (node.type === "whitespace" || node.type === "parbreak") continue;
    return null; // unexpected content outside an \item
  }
  return items.length > 0 ? items : null;
}

function promoteList(env: Ast.Environment, slice: string, ctx: InlineCtx): PMNode {
  const envName = env.env;
  const type = envName === "itemize" ? "bulletList" : "orderedList";
  const rawItems = splitListItems(env.content);
  if (!rawItems) return rawBlock(slice);

  const items: PMNode[] = [];
  for (const itemNodes of rawItems) {
    // Trim boundary whitespace inside the item.
    while (itemNodes.length && itemNodes[0]?.type === "whitespace") itemNodes.shift();
    while (itemNodes.length && itemNodes[itemNodes.length - 1]?.type === "whitespace")
      itemNodes.pop();

    const blocks: PMNode[] = [];
    let inlineRun: Node[] = [];
    const flushRun = () => {
      if (inlineRun.length === 0) return;
      const inner = promoteInlines(inlineRun, ctx);
      if (inner === null) throw new Error("bail");
      blocks.push({ type: "paragraph", content: inner });
      inlineRun = [];
    };
    try {
      for (const node of itemNodes) {
        if (
          node.type === "environment" &&
          (node.env === "itemize" || node.env === "enumerate")
        ) {
          // Trailing whitespace before a nested list is layout, drop it.
          while (
            inlineRun.length &&
            inlineRun[inlineRun.length - 1]?.type === "whitespace"
          )
            inlineRun.pop();
          flushRun();
          const range = segmentRange([node]);
          if (!range) throw new Error("bail");
          blocks.push(promoteList(node, ctx.source.slice(range[0], range[1]), ctx));
        } else {
          inlineRun.push(node);
        }
      }
      flushRun();
    } catch {
      return rawBlock(slice);
    }
    items.push({ type: "listItem", content: blocks });
  }

  const candidate: PMNode = { type, content: items };
  return withVerify(candidate, slice, true);
}

function promoteBlockquote(env: Ast.Environment, slice: string, ctx: InlineCtx): PMNode {
  const innerBlocks = promoteBlocksOf(env.content, ctx);
  if (!innerBlocks) return rawBlock(slice);
  const candidate: PMNode = {
    type: "blockquote",
    attrs: { env: "citacao" },
    content: innerBlocks.map((b) => {
      const attrs = { ...b.attrs };
      delete attrs.gapBefore;
      return { ...b, attrs };
    }),
  };
  return withVerify(candidate, slice, true);
}

function findMacro(nodes: Node[], name: string): Ast.Macro | null {
  for (const node of nodes) {
    if (node.type === "macro" && node.content === name) return node;
    if (node.type === "environment" || node.type === "group") {
      const found = findMacro(node.content, name);
      if (found) return found;
    }
    if (node.type === "macro" && node.args) {
      for (const arg of node.args) {
        const found = findMacro(arg.content, name);
        if (found) return found;
      }
    }
  }
  return null;
}

function promoteFigure(env: Ast.Environment, slice: string, ctx: InlineCtx): PMNode {
  const placementMatch = slice.match(/^\\begin\{figure\}\[([^\]]*)\]/);

  let src: string | null = null;
  let options: string | null = null;
  const graphics = findMacro(env.content, "includegraphics");
  if (graphics) {
    const gStart = offsetOf(graphics, "start");
    if (gStart !== null) {
      const args = sliceArgs(ctx.source, gStart + "\\includegraphics".length, true);
      if (args) {
        src = args.mandatory;
        options = args.opt;
      }
    }
  }

  let caption: string | null = null;
  let label: string | null = null;
  const captionMacro =
    findMacro(env.content, "caption") ?? findMacro(env.content, "Caption");
  if (captionMacro) {
    const cStart = offsetOf(captionMacro, "start");
    if (cStart !== null) {
      const args = sliceArgs(ctx.source, cStart + 1 + captionMacro.content.length, true);
      if (args?.mandatory != null) {
        const labelMatch = args.mandatory.match(/\\label\{([^}]*)\}/);
        label = labelMatch?.[1] ?? null;
        caption = args.mandatory.replace(/\\label\{[^}]*\}/, "").trim();
      }
    }
  }
  if (label === null) {
    const labelMacro = findMacro(env.content, "label");
    if (labelMacro) {
      const lStart = offsetOf(labelMacro, "start");
      if (lStart !== null) {
        label =
          sliceArgs(ctx.source, lStart + "\\label".length, false)?.mandatory ?? null;
      }
    }
  }

  return {
    type: "latexFigure",
    attrs: {
      placement: placementMatch?.[1] ?? null,
      src,
      options,
      caption,
      label,
      rawSource: slice,
    },
  };
}

function promoteMathEnv(_node: Node, slice: string): PMNode {
  let env: string;
  let inner: string;
  if (slice.startsWith("\\[")) {
    env = "display";
    inner = slice.slice(2, -2);
  } else {
    const match = slice.match(/^\\begin\{([^}]+)\}/);
    if (!match?.[1]) return rawBlock(slice);
    env = match[1];
    inner = slice.slice(`\\begin{${env}}`.length, -`\\end{${env}}`.length);
  }
  const tex = inner.replace(/^\n/, "").replace(/\n$/, "");
  const candidate: PMNode = { type: "mathBlock", attrs: { env, tex } };
  return withVerify(candidate, slice, true);
}

function promoteCodeBlock(slice: string): PMNode {
  const match = slice.match(
    /^\\begin\{lstlisting\}(?:\[([^\]]*)\])?\n?([\s\S]*?)\n?\\end\{lstlisting\}$/,
  );
  if (!match) return rawBlock(slice);
  const optionsRaw = match[1] ?? null;
  const languageMatch = optionsRaw?.match(/language=([^,\]]+)/);
  const code = match[2] ?? "";
  const candidate: PMNode = {
    type: "codeBlock",
    attrs: { language: languageMatch?.[1] ?? null },
    content: code === "" ? [] : [{ type: "text", text: code }],
  };
  return withVerify(candidate, slice, true);
}

function promoteCodeInclude(slice: string): PMNode {
  const match = slice.match(/^\\lstinputlisting(?:\[([^\]]*)\])?\{([^}]*)\}$/);
  if (!match) return rawBlock(slice);
  const candidate: PMNode = {
    type: "codeInclude",
    attrs: { options: match[1] ?? null, file: match[2] ?? "" },
  };
  return withVerify(candidate, slice, true);
}

function promoteEnvironment(env: Ast.Environment, slice: string, ctx: InlineCtx): PMNode {
  switch (env.env) {
    case "itemize":
    case "enumerate":
      return promoteList(env, slice, ctx);
    case "citacao":
      return promoteBlockquote(env, slice, ctx);
    case "figure":
      return promoteFigure(env, slice, ctx);
    case "table":
      return { type: "latexTable", attrs: { rawSource: slice } };
    case "lstlisting":
      return promoteCodeBlock(slice);
    case "equation":
    case "equation*":
    case "align":
    case "align*":
      return promoteMathEnv(env, slice);
    default:
      return rawBlock(slice);
  }
}

function promoteBlock(seg: Node[], slice: string, ctx: InlineCtx): PMNode {
  const solo = seg.length === 1 ? seg[0] : null;

  if (solo) {
    if (isHeadingMacro(solo)) return promoteHeading(solo as Ast.Macro, slice, ctx);
    if (solo.type === "comment") {
      const candidate: PMNode = {
        type: "latexComment",
        attrs: { text: slice.startsWith("%") ? slice.slice(1) : slice },
      };
      return withVerify(candidate, slice, false);
    }
    if (solo.type === "environment") {
      return promoteEnvironment(solo as Ast.Environment, slice, ctx);
    }
    if (solo.type === "verbatim") {
      const envName = (solo as unknown as { env: string }).env;
      if (envName === "lstlisting") return promoteCodeBlock(slice);
      return rawBlock(slice);
    }
    if (solo.type === "mathenv" || solo.type === "displaymath") {
      return promoteMathEnv(solo, slice);
    }
    if (solo.type === "macro" && solo.content === "lstinputlisting") {
      return promoteCodeInclude(slice);
    }
  }

  // Paragraph attempt.
  const inner = promoteInlines(seg, ctx);
  if (!inner) return rawBlock(slice);
  // A "paragraph" with no actual prose (only raw chunks + whitespace) is a
  // raw block — better editor semantics for \newcommand-style lines.
  const hasProse = inner.some(
    (n) => n.type !== "rawLatexInline" && !(n.type === "text" && !n.text?.trim()),
  );
  if (!hasProse) return rawBlock(slice);
  const candidate: PMNode = { type: "paragraph", content: inner };
  return withVerify(candidate, slice, false);
}

/** Segment + promote a node list (used for doc top level and citacao). */
function promoteBlocksOf(nodes: Node[], ctx: InlineCtx): PMNode[] | null {
  const segments = segmentBlocks(nodes);
  const out: PMNode[] = [];
  for (const seg of segments) {
    const range = segmentRange(seg);
    if (!range) return null;
    const slice = ctx.source.slice(range[0], range[1]);
    const node = promoteBlock(seg, slice, ctx);
    const firstNode = seg[0];
    if (firstNode) {
      const line = lineOf(firstNode);
      if (line !== undefined) node.attrs = { ...node.attrs, srcLine: line };
    }
    out.push(node);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function parseLatex(source: string): ParseResult {
  if (source === "") return degenerate(source);

  let ast: Ast.Root;
  try {
    ast = unifiedParse(source);
  } catch {
    return degenerate(source);
  }

  try {
    const ctx: InlineCtx = { source };
    const segments = segmentBlocks(ast.content);
    const content: PMNode[] = [];
    let cursor = 0;

    for (const seg of segments) {
      const range = segmentRange(seg);
      if (!range) return degenerate(source);
      const [start, end] = range;
      const slice = source.slice(start, end);
      const node = promoteBlock(seg, slice, ctx);
      const firstNode = seg[0];
      const line = firstNode ? lineOf(firstNode) : undefined;
      node.attrs = {
        ...node.attrs,
        gapBefore: source.slice(cursor, start),
        ...(line !== undefined ? { srcLine: line } : {}),
      };
      content.push(node);
      cursor = end;
    }

    const doc: PMDoc = { type: "doc", content };
    (doc as unknown as { attrs: Record<string, unknown> }).attrs = {
      gapAfter: source.slice(cursor),
    };

    // Unconditional Invariant #1 backstop.
    if (serializeDoc(doc) !== source) return degenerate(source);
    return { doc };
  } catch {
    return degenerate(source);
  }
}
