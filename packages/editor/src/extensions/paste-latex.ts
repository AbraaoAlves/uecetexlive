/**
 * PasteLatex (§4.4): pasted text containing LaTeX commands runs through
 * parseLatex and inserts the mapped fragment instead of raw text.
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { parseLatex } from "@uecetexlive/latex-mapping";

export const PasteLatex = Extension.create({
  name: "pasteLatex",
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("pasteLatex"),
        props: {
          handlePaste(_view, event) {
            const text = event.clipboardData?.getData("text/plain");
            if (!text?.includes("\\")) return false;
            const { doc } = parseLatex(text);
            if (doc.content.length === 0) return false;
            editor.commands.insertContent(doc.content);
            return true;
          },
        },
      }),
    ];
  },
});
