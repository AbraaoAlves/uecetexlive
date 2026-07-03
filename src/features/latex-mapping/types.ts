/**
 * Plain-object ProseMirror JSON shapes (§4.3) — this package never imports
 * Tiptap/DOM; the editor materializes these into real PM nodes.
 */
export interface PMMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  marks?: PMMark[];
  text?: string;
}

export interface PMDoc {
  type: "doc";
  content: PMNode[];
}

export interface ParseResult {
  doc: PMDoc;
}
