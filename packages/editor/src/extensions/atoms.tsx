/**
 * Inline/block atom nodes with React node views (§4.2/§4.4): citation,
 * crossref, math (KaTeX), figure, table projection, code include, footnote.
 */

import { editCell, parseTable, serializeTable, tableRows } from "@papyru/latex-mapping";
import { mergeAttributes, Node } from "@tiptap/core";
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import katex from "katex";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { EditorResourcesContext } from "../resources";
import { useEditorStrings } from "../strings";
import { cn } from "../utils";

// ---------------------------------------------------------------------------
// KaTeX helper
// ---------------------------------------------------------------------------

function KatexView({ tex, display }: { tex: string; display: boolean }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, {
        displayMode: display,
        throwOnError: false,
      });
    } catch {
      return null;
    }
  }, [tex, display]);
  if (html === null) return <code>{tex}</code>;
  // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output over user's own math
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function useEditPopover(initial: string, onCommit: (value: string) => void) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  const commit = () => {
    setOpen(false);
    if (value !== initial) onCommit(value);
  };
  return { open, setOpen, value, setValue, commit };
}

function EditPopover({
  value,
  onChange,
  onCommit,
  mono = true,
  livePreview = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  mono?: boolean;
  /** Render a live KaTeX preview of `value` under the textarea (math edit). */
  livePreview?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="absolute top-full left-0 z-50 mt-1 w-72 rounded-md border bg-surface-elevated p-2 shadow-lg">
      <textarea
        ref={ref}
        className={cn(
          "h-20 w-full resize-none rounded border bg-background p-1.5 text-xs outline-none",
          mono && "font-mono",
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Escape" || (e.key === "Enter" && e.ctrlKey)) onCommit();
        }}
      />
      {livePreview && (
        <div
          className="mt-1.5 min-h-8 overflow-x-auto rounded border border-dashed bg-background px-2 py-1.5 text-center"
          data-testid="math-live-preview"
        >
          {value.trim() ? (
            <KatexView tex={value} display />
          ) : (
            <span className="text-ink-subtle text-xs">Pré-visualização</span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Citation
// ---------------------------------------------------------------------------

function CitationView({ node }: NodeViewProps) {
  const resources = useContext(EditorResourcesContext);
  const keys = (node.attrs.keys as string[]) ?? [];
  const label = resources.citationLabel(keys);
  return (
    <NodeViewWrapper as="span" data-testid="citation-chip">
      <span
        className="rounded bg-accent-soft px-1 py-0.5 text-accent-strong text-sm"
        title={`\\${node.attrs.cmd}{${keys.join(",")}}`}
      >
        {label}
      </span>
    </NodeViewWrapper>
  );
}

export const Citation = Node.create({
  name: "citation",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      cmd: { default: "cite" },
      keys: { default: [] },
      opt: { default: null },
      rawSource: { default: null, rendered: false },
    };
  },
  parseHTML: () => [{ tag: "span[data-citation]" }],
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-citation": "1" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CitationView);
  },
});

// ---------------------------------------------------------------------------
// CrossRef
// ---------------------------------------------------------------------------

function CrossRefView({ node }: NodeViewProps) {
  return (
    <NodeViewWrapper as="span" data-testid="crossref-chip">
      <span
        className="rounded bg-surface px-1 py-0.5 text-ink-muted text-sm ring-1 ring-border"
        title={`\\${node.attrs.cmd}{${node.attrs.target}}`}
      >
        → {node.attrs.target as string}
      </span>
    </NodeViewWrapper>
  );
}

export const CrossRef = Node.create({
  name: "crossref",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      cmd: { default: "ref" },
      target: { default: "" },
      rawSource: { default: null, rendered: false },
    };
  },
  parseHTML: () => [{ tag: "span[data-crossref]" }],
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-crossref": "1" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CrossRefView);
  },
});

// ---------------------------------------------------------------------------
// Math (inline + block)
// ---------------------------------------------------------------------------

function MathInlineView({ node, updateAttributes }: NodeViewProps) {
  const pop = useEditPopover(node.attrs.tex as string, (tex) =>
    updateAttributes({ tex, rawSource: null }),
  );
  return (
    <NodeViewWrapper as="span" className="relative" data-testid="math-inline">
      <button
        type="button"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => pop.setOpen(true)}
        className="align-middle"
      >
        <KatexView tex={node.attrs.tex as string} display={false} />
      </button>
      {pop.open && (
        <EditPopover
          value={pop.value}
          onChange={pop.setValue}
          onCommit={pop.commit}
          livePreview
        />
      )}
    </NodeViewWrapper>
  );
}

export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      tex: { default: "" },
      delim: { default: "dollar" },
      rawSource: { default: null, rendered: false },
    };
  },
  parseHTML: () => [{ tag: "span[data-math-inline]" }],
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-math-inline": "1" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView);
  },
});

function MathBlockView({ node, updateAttributes }: NodeViewProps) {
  const pop = useEditPopover(node.attrs.tex as string, (tex) =>
    updateAttributes({ tex, rawSource: null }),
  );
  return (
    <NodeViewWrapper className="relative" data-testid="math-block">
      <button
        type="button"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => pop.setOpen(true)}
        className="block w-full rounded p-2 text-center hover:bg-surface"
      >
        <KatexView tex={node.attrs.tex as string} display />
      </button>
      {pop.open && (
        <EditPopover
          value={pop.value}
          onChange={pop.setValue}
          onCommit={pop.commit}
          livePreview
        />
      )}
    </NodeViewWrapper>
  );
}

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      env: { default: "display" },
      tex: { default: "" },
    };
  },
  parseHTML: () => [{ tag: "div[data-math-block]" }],
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-math-block": "1" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView);
  },
});

// ---------------------------------------------------------------------------
// Figure
// ---------------------------------------------------------------------------

function FigureView({ node, updateAttributes }: NodeViewProps) {
  const resources = useContext(EditorResourcesContext);
  const src = node.attrs.src as string | null;
  const url = src ? resources.imageUrl(src) : null;
  const isPdf = src?.toLowerCase().endsWith(".pdf") ?? false;

  return (
    <NodeViewWrapper data-testid="figure-node">
      <figure className="my-2 rounded-md border bg-surface p-3 text-center">
        {url && !isPdf ? (
          <img
            src={url}
            alt={(node.attrs.caption as string) ?? src ?? ""}
            className="mx-auto max-h-72"
          />
        ) : (
          <div className="py-6 text-ink-subtle text-sm">
            {url === null && src
              ? `Arquivo não encontrado: ${src}`
              : isPdf
                ? `PDF: ${src}`
                : "Sem imagem"}
          </div>
        )}
        <figcaption className="mt-2">
          <input
            data-testid="figure-caption"
            className="w-full bg-transparent text-center text-ink-muted text-sm outline-none"
            value={(node.attrs.caption as string) ?? ""}
            placeholder="Legenda…"
            onChange={(e) =>
              updateAttributes({ caption: e.target.value, rawSource: null })
            }
          />
          <label className="mt-1 flex items-center gap-1 text-ink-subtle text-xs">
            <span aria-hidden="true">\Fonte{"{"}</span>
            <input
              data-testid="figure-fonte"
              className="min-w-0 flex-1 bg-transparent text-center outline-none"
              value={(node.attrs.fonte as string) ?? ""}
              onChange={(e) =>
                updateAttributes({ fonte: e.target.value, rawSource: null })
              }
            />
            <span aria-hidden="true">{"}"}</span>
          </label>
        </figcaption>
        {node.attrs.label ? (
          <span className="text-[10px] text-ink-subtle">
            \label{"{"}
            {node.attrs.label as string}
            {"}"}
          </span>
        ) : null}
      </figure>
    </NodeViewWrapper>
  );
}

export const LatexFigure = Node.create({
  name: "latexFigure",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      placement: { default: null },
      src: { default: null },
      options: { default: null },
      caption: { default: null },
      label: { default: null },
      fonte: { default: null },
    };
  },
  parseHTML: () => [{ tag: "figure[data-latex-figure]" }],
  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes, { "data-latex-figure": "1" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FigureView);
  },
});

// ---------------------------------------------------------------------------
// Table (§4.2): editable grid for flat tabulars, read-only projection for
// anything the grid model can't safely rebuild.
// ---------------------------------------------------------------------------

function TableView({ node, editor, getPos, updateAttributes }: NodeViewProps) {
  const strings = useEditorStrings();
  const raw = (node.attrs.rawSource as string) ?? "";
  const model = useMemo(() => parseTable(raw), [raw]);

  const editAsLatex = () => {
    const pos = getPos();
    if (pos === undefined) return;
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: pos, to: pos + node.nodeSize },
        {
          type: "rawLatexBlock",
          content: raw ? [{ type: "text", text: raw }] : [],
        },
      )
      .run();
  };

  // Fallback: no safely-editable grid (nested tabular, no rows) → read-only.
  if (!model) {
    return (
      <NodeViewWrapper data-testid="table-node">
        <div className="my-2 rounded-md border bg-surface p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-medium text-ink-muted text-xs">
              {strings.editor.tableLabel}
            </span>
            <button
              type="button"
              className="text-accent text-xs hover:underline"
              onClick={editAsLatex}
            >
              {strings.editor.editAsLatex}
            </button>
          </div>
          <pre className="max-h-40 overflow-auto font-mono text-[11px] text-ink-subtle">
            {raw}
          </pre>
        </div>
      </NodeViewWrapper>
    );
  }

  const rows = tableRows(model);
  return (
    <NodeViewWrapper data-testid="table-node">
      <div className="my-2 rounded-md border bg-surface p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-medium text-ink-muted text-xs">
            {strings.editor.tableLabel}
          </span>
          <button
            type="button"
            data-testid="table-edit-latex"
            className="text-accent text-xs hover:underline"
            onClick={editAsLatex}
          >
            {strings.editor.editAsLatex}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" data-testid="table-grid">
            <tbody>
              {rows.map((row, r) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: row order is the table's identity
                <tr key={r}>
                  {row.cells.map((cell, c) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: column order is stable
                    <td key={c} className="border p-0">
                      <input
                        data-testid={`table-cell-${r}-${c}`}
                        className="w-full min-w-24 bg-transparent px-2 py-1 outline-none focus:bg-accent-soft/40"
                        defaultValue={cell}
                        onBlur={(e) => {
                          if (e.target.value === cell) return;
                          updateAttributes({
                            rawSource: serializeTable(
                              editCell(model, r, c, e.target.value),
                            ),
                          });
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const LatexTable = Node.create({
  name: "latexTable",
  group: "block",
  atom: true,
  addAttributes() {
    // rawSource is the table's ground truth. Declared here (not only via the
    // global FidelityAttributes) so it survives Node.fromJSON when the editor
    // loads content — otherwise the whole table serializes back to nothing.
    return {
      rawSource: { default: null, rendered: false, keepOnSplit: false },
    };
  },
  parseHTML: () => [{ tag: "div[data-latex-table]" }],
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-latex-table": "1" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(TableView);
  },
});

// ---------------------------------------------------------------------------
// Code include
// ---------------------------------------------------------------------------

function CodeIncludeView({ node }: NodeViewProps) {
  const resources = useContext(EditorResourcesContext);
  const file = node.attrs.file as string;
  const preview = resources.textFilePreview(file, 8);
  return (
    <NodeViewWrapper data-testid="code-include-node">
      <div className="my-2 rounded-md border bg-surface p-3">
        <div className="mb-1 font-medium text-ink-muted text-xs">
          Código-fonte: {file}
        </div>
        <pre className="max-h-32 overflow-auto font-mono text-[11px] text-ink-subtle">
          {preview ?? "arquivo não encontrado"}
        </pre>
      </div>
    </NodeViewWrapper>
  );
}

export const CodeInclude = Node.create({
  name: "codeInclude",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      options: { default: null },
      file: { default: "" },
    };
  },
  parseHTML: () => [{ tag: "div[data-code-include]" }],
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-code-include": "1" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeIncludeView);
  },
});

// ---------------------------------------------------------------------------
// Footnote
// ---------------------------------------------------------------------------

function FootnoteView({ node, updateAttributes }: NodeViewProps) {
  const pop = useEditPopover(node.attrs.latex as string, (latex) =>
    updateAttributes({ latex, rawSource: null }),
  );
  return (
    <NodeViewWrapper as="span" className="relative" data-testid="footnote-node">
      <button
        type="button"
        onClick={() => pop.setOpen(true)}
        className="rounded bg-warning/20 px-1 align-super text-[10px]"
        title={node.attrs.latex as string}
      >
        nota
      </button>
      {pop.open && (
        <EditPopover
          value={pop.value}
          onChange={pop.setValue}
          onCommit={pop.commit}
          mono={false}
        />
      )}
    </NodeViewWrapper>
  );
}

export const Footnote = Node.create({
  name: "footnote",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      latex: { default: "" },
      rawSource: { default: null, rendered: false },
    };
  },
  parseHTML: () => [{ tag: "span[data-footnote]" }],
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-footnote": "1" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FootnoteView);
  },
});
