/**
 * SlashMenu (§4.5) on @tiptap/suggestion — pt-BR commands, filtered as you
 * type after "/". Positioning is a plain fixed-position portal (no tippy).
 */
import { type Editor, Extension, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { type SlashItem, SlashMenuList, type SlashMenuListHandle } from "./SlashMenuList";

export type PickerKind = "citation" | "crossref" | "figure" | "codeInclude";

export interface SlashMenuOptions {
  /** Opens the picker dialogs owned by EditorSurface. */
  openPicker: (kind: PickerKind, range: Range) => void;
}

export interface CommandDef {
  id: string;
  label: string;
  run: (editor: Editor, range: Range, options: SlashMenuOptions) => void;
}

const COMMANDS: CommandDef[] = [
  {
    id: "capitulo",
    label: "Título de capítulo",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    id: "secao",
    label: "Seção",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    id: "subsecao",
    label: "Subseção",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    id: "figura",
    label: "Figura do projeto",
    run: (_editor, range, options) => options.openPicker("figure", range),
  },
  {
    id: "tabela",
    label: "Tabela 3×3 (LaTeX)",
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "rawLatexBlock",
          content: [
            {
              type: "text",
              text: "\\begin{table}[htb]\n\t\\centering\n\t\\caption{Legenda}\n\t\\begin{tabular}{ccc}\n\t\tA & B & C \\\\\n\t\t1 & 2 & 3 \\\\\n\t\t4 & 5 & 6 \\\\\n\t\\end{tabular}\n\\end{table}",
            },
          ],
        })
        .run(),
  },
  {
    id: "lista",
    label: "Lista com marcadores",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: "lista-numerada",
    label: "Lista numerada",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: "citacao",
    label: "Citação bibliográfica",
    run: (_editor, range, options) => options.openPicker("citation", range),
  },
  {
    id: "citacao-longa",
    label: "Citação longa (ABNT 4cm)",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setBlockquote().run(),
  },
  {
    id: "referencia",
    label: "Referência cruzada",
    run: (_editor, range, options) => options.openPicker("crossref", range),
  },
  {
    id: "equacao",
    label: "Equação (bloco)",
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "mathBlock", attrs: { env: "equation", tex: "x = 1" } })
        .run(),
  },
  {
    id: "codigo",
    label: "Bloco de código",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setNode("codeBlock").run(),
  },
  {
    id: "codigo-arquivo",
    label: "Código de arquivo do projeto",
    run: (_editor, range, options) => options.openPicker("codeInclude", range),
  },
  {
    id: "nota",
    label: "Nota de rodapé",
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "footnote", attrs: { latex: "Nota" } })
        .run(),
  },
  {
    id: "latex",
    label: "Bloco LaTeX bruto",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setNode("rawLatexBlock").run(),
  },
];

/** Shared with the fixed toolbar — same insertions, one definition. */
export function getSlashCommand(id: string): CommandDef {
  const command = COMMANDS.find((c) => c.id === id);
  if (!command) throw new Error(`Unknown slash command: ${id}`);
  return command;
}

export const SlashMenu = Extension.create<SlashMenuOptions>({
  name: "slashMenu",

  addOptions() {
    return { openPicker: () => {} };
  },

  addProseMirrorPlugins() {
    const extensionOptions = this.options;
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        startOfLine: false,
        command: ({ editor, range, props }) => {
          (props as CommandDef).run(editor as Editor, range, extensionOptions);
        },
        items: ({ query }) =>
          COMMANDS.filter((c) => c.id.toLowerCase().startsWith(query.toLowerCase())),
        render: () => {
          let renderer: ReactRenderer<SlashMenuListHandle> | null = null;
          let container: HTMLDivElement | null = null;

          const position = (clientRect?: (() => DOMRect | null) | null) => {
            const rect = clientRect?.();
            if (!rect || !container) return;
            // Clamp into the viewport; flip above the caret near the bottom
            // edge (typing at document end).
            const menuHeight = Math.min(container.offsetHeight || 240, 300);
            const menuWidth = container.offsetWidth || 256;
            const below = rect.bottom + 4;
            const top =
              below + menuHeight > window.innerHeight
                ? Math.max(4, rect.top - menuHeight - 4)
                : below;
            const left = Math.min(rect.left, window.innerWidth - menuWidth - 8);
            container.style.left = `${Math.max(4, left)}px`;
            container.style.top = `${top}px`;
          };

          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashMenuList, {
                props: {
                  items: props.items.map((item: CommandDef) => ({
                    id: item.id,
                    label: item.label,
                    run: () => props.command(item),
                  })) satisfies SlashItem[],
                },
                editor: props.editor as Editor,
              });
              container = document.createElement("div");
              container.style.position = "fixed";
              container.style.zIndex = "50";
              container.appendChild(renderer.element);
              document.body.appendChild(container);
              position(props.clientRect);
            },
            onUpdate: (props) => {
              renderer?.updateProps({
                items: props.items.map((item: CommandDef) => ({
                  id: item.id,
                  label: item.label,
                  run: () => props.command(item),
                })),
              });
              position(props.clientRect);
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                container?.remove();
                renderer?.destroy();
                renderer = null;
                return true;
              }
              return renderer?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              container?.remove();
              renderer?.destroy();
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});
