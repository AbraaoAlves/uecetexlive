/**
 * Fixed formatting toolbar above the WYSIWYG surface (QA Fase 1) — the
 * always-visible counterpart of the BubbleMenu/slash menu, so Perfil-A
 * students can format without knowing any shortcut.
 */
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Search,
  Sigma,
  Table,
  TextQuote,
  Underline,
} from "lucide-react";
import type { PickerKind } from "./slash-menu/slash-menu";
import { getSlashCommand } from "./slash-menu/slash-menu";
import { useEditorStrings } from "./strings";
import { Tooltip } from "./Tooltip";
import { cn } from "./utils";

export interface EditorToolbarProps {
  editor: Editor;
  onOpenPicker: (kind: PickerKind) => void;
  /** Opens the Find & Replace panel (QA §A2). */
  onOpenFind?: () => void;
}

export function EditorToolbar({ editor, onOpenPicker, onOpenFind }: EditorToolbarProps) {
  const strings = useEditorStrings();
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      code: e.isActive("code"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
    }),
  });

  const insertViaSlash = (id: string) => {
    const { from, to } = editor.state.selection;
    getSlashCommand(id).run(editor, { from, to }, { openPicker: () => {} });
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatação"
      data-testid="editor-toolbar"
      className="flex shrink-0 flex-wrap items-center gap-0.5 border-b bg-surface px-2 py-1"
    >
      <ToolbarButton
        testid="toolbar-bold"
        label={strings.toolbar.bold}
        active={active.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        testid="toolbar-italic"
        label={strings.toolbar.italic}
        active={active.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        testid="toolbar-underline"
        label={strings.toolbar.underline}
        active={active.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        testid="toolbar-code"
        label={strings.toolbar.code}
        active={active.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="size-3.5" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        testid="toolbar-h1"
        label={strings.toolbar.chapter}
        active={active.h1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        testid="toolbar-h2"
        label={strings.toolbar.section}
        active={active.h2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        testid="toolbar-h3"
        label={strings.toolbar.subsection}
        active={active.h3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="size-3.5" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        testid="toolbar-bullet-list"
        label={strings.toolbar.bulletList}
        active={active.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        testid="toolbar-ordered-list"
        label={strings.toolbar.orderedList}
        active={active.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        testid="toolbar-blockquote"
        label={strings.toolbar.blockquote}
        active={active.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <TextQuote className="size-3.5" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        testid="toolbar-cite"
        label={strings.toolbar.citation}
        active={false}
        onClick={() => onOpenPicker("citation")}
      >
        <Quote className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        testid="toolbar-ref"
        label={strings.toolbar.crossref}
        active={false}
        onClick={() => onOpenPicker("crossref")}
      >
        <Link2 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        testid="toolbar-figure"
        label={strings.toolbar.figure}
        active={false}
        onClick={() => onOpenPicker("figure")}
      >
        <Image className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        testid="toolbar-table"
        label={strings.toolbar.table}
        active={false}
        onClick={() => insertViaSlash("tabela")}
      >
        <Table className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        testid="toolbar-equation"
        label={strings.toolbar.equation}
        active={false}
        onClick={() => insertViaSlash("equacao")}
      >
        <Sigma className="size-3.5" />
      </ToolbarButton>

      {onOpenFind && (
        <>
          <Divider />
          <ToolbarButton
            testid="toolbar-find"
            label={strings.editor.findHint}
            active={false}
            onClick={onOpenFind}
          >
            <Search className="size-3.5" />
          </ToolbarButton>
        </>
      )}
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden="true" />;
}

function ToolbarButton({
  testid,
  label,
  active,
  onClick,
  children,
}: {
  testid: string;
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        data-testid={testid}
        aria-label={label}
        aria-pressed={active}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={cn(
          "rounded p-1.5 text-ink-muted hover:bg-accent-soft",
          active && "bg-accent-soft text-accent-strong",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}
