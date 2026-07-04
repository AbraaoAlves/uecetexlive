/**
 * The WYSIWYG surface (§4.6 center pane): one Tiptap instance, setContent on
 * file switch (§12), serialize-on-update through latex-mapping. Ground truth
 * is always the LaTeX source (§4.1).
 */
import { EditorContent, type Range, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Code, ImagePlus, Italic, Underline as UnderlineIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseLatex } from "@/features/latex-mapping/parse";
import { serializeDoc } from "@/features/latex-mapping/serialize";
import type { PMDoc } from "@/features/latex-mapping/types";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { EditorToolbar } from "./EditorToolbar";
import { buildExtensions } from "./extensions";
import { type EditorResources, EditorResourcesContext } from "./resources";
import type { PickerKind } from "./slash-menu/slash-menu";
import "katex/dist/katex.min.css";

export interface EditorSurfaceProps {
  path: string;
  source: string;
  resources: EditorResources;
  onChange: (source: string) => void;
}

interface PickerState {
  kind: PickerKind;
  range: Range;
}

export function EditorSurface({ path, source, resources, onChange }: EditorSurfaceProps) {
  const [picker, setPicker] = useState<PickerState | null>(null);
  // Which file the editor currently holds. Initialized to the mount path so
  // the initial `content` (below) is not re-applied by the switch effect.
  const loadedKey = useRef<string>(path);
  const applyingExternal = useRef(false);
  // Latest-prop refs: the editor instance is created exactly once per mount
  // (§12) — options capture these refs, never render-scope closures.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const sourceRef = useRef(source);
  sourceRef.current = source;

  const editor = useEditor(
    {
      extensions: buildExtensions({
        openPicker: (kind, range) => setPicker({ kind, range }),
      }),
      // Initial content is set at creation — setContent() issued before the
      // editor's internal create is silently discarded, so we never rely on
      // an effect for the first load.
      content: parseLatex(source).doc as never,
      editorProps: {
        attributes: {
          class: "uecetex-editor mx-auto min-h-full max-w-3xl px-8 py-6 outline-none",
          "data-testid": "wysiwyg-editor",
        },
      },
      onCreate: ({ editor: current }) => {
        (window as unknown as Record<string, unknown>).__uecetexEditor = current;
        (window as unknown as Record<string, unknown>).__serialize = (json: unknown) =>
          serializeDoc(json as PMDoc);
      },
      onUpdate: ({ editor: current }) => {
        if (applyingExternal.current) return;
        const json = current.getJSON() as unknown as PMDoc;
        onChangeRef.current(serializeDoc(json));
      },
    },
    [],
  );

  // Reload only on an actual file switch (path change); never on our own
  // onChange echoes.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (loadedKey.current === path) return;
    loadedKey.current = path;
    applyingExternal.current = true;
    const { doc } = parseLatex(sourceRef.current);
    editor.commands.setContent(doc as never, { emitUpdate: false });
    applyingExternal.current = false;
  }, [editor, path]);

  const insertAtRange = useCallback(
    (content: Record<string, unknown>) => {
      if (!editor || !picker) return;
      editor
        .chain()
        .focus()
        .deleteRange(picker.range)
        .insertContent(content as never)
        .run();
      setPicker(null);
    },
    [editor, picker],
  );

  if (!editor) return null;

  return (
    <EditorResourcesContext.Provider value={resources}>
      <div className="flex h-full flex-col" data-testid="editor-surface">
        <EditorToolbar
          editor={editor}
          onOpenPicker={(kind) => {
            const { from, to } = editor.state.selection;
            setPicker({ kind, range: { from, to } });
          }}
        />
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <EditorContent editor={editor} className="h-full" />

          <BubbleMenu editor={editor} data-testid="bubble-menu">
            <div className="flex items-center gap-0.5 rounded-md border bg-surface-elevated p-0.5 shadow-md">
              <BubbleButton
                active={editor.isActive("bold")}
                onClick={() => editor.chain().focus().toggleBold().run()}
                label="Negrito"
              >
                <Bold className="size-3.5" />
              </BubbleButton>
              <BubbleButton
                active={editor.isActive("italic")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                label="Itálico"
              >
                <Italic className="size-3.5" />
              </BubbleButton>
              <BubbleButton
                active={editor.isActive("underline")}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                label="Sublinhado"
              >
                <UnderlineIcon className="size-3.5" />
              </BubbleButton>
              <BubbleButton
                active={editor.isActive("code")}
                onClick={() => editor.chain().focus().toggleCode().run()}
                label="Monoespaçado"
              >
                <Code className="size-3.5" />
              </BubbleButton>
              <BubbleButton
                active={false}
                onClick={() => {
                  const { from, to } = editor.state.selection;
                  setPicker({ kind: "citation", range: { from, to } });
                }}
                label="Citar"
              >
                <span className="px-1 text-xs">cite</span>
              </BubbleButton>
            </div>
          </BubbleMenu>

          {picker && (
            <PickerDialog
              kind={picker.kind}
              resources={resources}
              onClose={() => setPicker(null)}
              onPick={insertAtRange}
            />
          )}
        </div>
      </div>
    </EditorResourcesContext.Provider>
  );
}

function BubbleButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "rounded p-1.5 hover:bg-accent-soft",
        active && "bg-accent-soft text-accent-strong",
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Pickers (§4.5 slash targets)
// ---------------------------------------------------------------------------

function PickerDialog({
  kind,
  resources,
  onClose,
  onPick,
}: {
  kind: PickerKind;
  resources: EditorResources;
  onClose: () => void;
  onPick: (content: Record<string, unknown>) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.toLowerCase();

  let body: React.ReactNode;
  if (kind === "citation") {
    const results = resources.bibEntries.filter(
      (e) =>
        e.key.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.author.toLowerCase().includes(q) ||
        e.year.includes(q),
    );
    body = results.length ? (
      results.map((entry) => (
        <PickerRow
          key={entry.key}
          testid={`pick-cite-${entry.key}`}
          onClick={() =>
            onPick({
              type: "citation",
              attrs: { cmd: "cite", keys: [entry.key], opt: null },
            })
          }
        >
          <span className="font-medium">
            {entry.author.toUpperCase()}, {entry.year}
          </span>{" "}
          <span className="text-ink-subtle">{entry.title.slice(0, 60)}</span>
        </PickerRow>
      ))
    ) : (
      <Empty>Nenhuma referência encontrada</Empty>
    );
  } else if (kind === "crossref") {
    const results = resources.labels.filter((l) => l.toLowerCase().includes(q));
    body = results.length ? (
      results.map((label) => (
        <PickerRow
          key={label}
          testid={`pick-ref-${label}`}
          onClick={() =>
            onPick({ type: "crossref", attrs: { cmd: "ref", target: label } })
          }
        >
          {label}
        </PickerRow>
      ))
    ) : (
      <Empty>Nenhum rótulo (\label) no projeto</Empty>
    );
  } else if (kind === "figure") {
    const results = resources.imageFiles.filter((f) => f.toLowerCase().includes(q));
    const rows = results.length ? (
      results.map((file) => (
        <PickerRow
          key={file}
          testid={`pick-fig-${file}`}
          onClick={() =>
            onPick({
              type: "latexFigure",
              attrs: {
                src: file.replace(/\.(png|jpe?g|pdf)$/i, ""),
                options: "width=0.8\\textwidth",
                caption: "Legenda",
                label: `fig:${file.split("/").pop()?.split(".")[0] ?? "nova"}`,
                placement: "htb",
              },
            })
          }
        >
          {file}
        </PickerRow>
      ))
    ) : (
      <Empty>Nenhuma imagem em figuras/</Empty>
    );
    body = (
      <>
        <UploadImageRow resources={resources} onPick={onPick} />
        {rows}
      </>
    );
  } else {
    const results = resources.codeFiles.filter((f) => f.toLowerCase().includes(q));
    body = results.length ? (
      results.map((file) => (
        <PickerRow
          key={file}
          testid={`pick-code-${file}`}
          onClick={() =>
            onPick({ type: "codeInclude", attrs: { file, options: "language=C++" } })
          }
        >
          {file}
        </PickerRow>
      ))
    ) : (
      <Empty>Nenhum arquivo de código no projeto</Empty>
    );
  }

  return (
    <div
      className="absolute inset-0 z-40 flex items-start justify-center bg-ink/20 pt-16"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="dialog"
      aria-modal="true"
      data-testid={`picker-${kind}`}
    >
      <div
        className="w-96 rounded-lg border bg-surface-elevated shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
        role="document"
      >
        <input
          // biome-ignore lint/a11y/noAutofocus: picker is an ephemeral command palette
          autoFocus
          className="w-full border-b bg-transparent px-3 py-2 text-sm outline-none"
          placeholder="Buscar…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="picker-search"
        />
        <div className="max-h-64 overflow-y-auto py-1">{body}</div>
      </div>
    </div>
  );
}

/** First row of the figure picker: upload from disk into figuras/ (QA Fase 1). */
function UploadImageRow({
  resources,
  onPick,
}: {
  resources: EditorResources;
  onPick: (content: Record<string, unknown>) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="border-b">
      <label
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-accent-strong text-sm hover:bg-accent-soft"
        data-testid="picker-upload"
      >
        <ImagePlus className="size-3.5 shrink-0" />
        {strings.editor.uploadImage}
        <input
          type="file"
          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
          className="hidden"
          data-testid="picker-upload-input"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const path = await resources.uploadImage(file);
            if (!path) {
              setError(strings.editor.uploadImageError);
              return;
            }
            const base =
              path
                .split("/")
                .pop()
                ?.replace(/\.[^.]*$/, "") ?? "nova";
            onPick({
              type: "latexFigure",
              attrs: {
                src: path.replace(/\.(png|jpe?g)$/i, ""),
                options: "width=0.8\\textwidth",
                caption: "Legenda",
                label: `fig:${base}`,
                placement: "htb",
              },
            });
          }}
        />
      </label>
      {error && (
        <div className="px-3 pb-2 text-danger text-xs" data-testid="picker-upload-error">
          {error}
        </div>
      )}
    </div>
  );
}

function PickerRow({
  children,
  onClick,
  testid,
}: {
  children: React.ReactNode;
  onClick: () => void;
  testid: string;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent-soft"
    >
      {children}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-4 text-center text-ink-subtle text-sm">{children}</div>;
}
