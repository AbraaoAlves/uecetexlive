/**
 * VFS helpers — pure functions over project file paths and bytes (§3.8, §4.1).
 * Binary fidelity rule: Uint8Array end-to-end; text conversion only at the
 * editor boundary, via TextEncoder/TextDecoder (UTF-8).
 */
import type { FileKind } from "./schema";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: false });

export function textToBytes(text: string): Uint8Array {
  return encoder.encode(text);
}

export function bytesToText(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

export function kindOf(path: string): FileKind {
  const name = path.split("/").pop() ?? path;
  const ext = name.includes(".") ? (name.split(".").pop() ?? "") : "";
  switch (ext.toLowerCase()) {
    case "tex":
      return "tex";
    case "bib":
      return "bib";
    case "bst":
      return "bst";
    case "sty":
      return "sty";
    case "cls":
      return "cls";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
      return "image";
    case "pdf":
      return "pdf";
    case "cpp":
    case "c":
    case "h":
    case "java":
    case "py":
    case "js":
    case "ts":
      return "code";
    default:
      return "other";
  }
}

/** Prose pre-textuals that are WYSIWYG-editable (§4.1 item 4). */
const PROSE_PRE_TEXTUALS = new Set([
  "elementos-pre-textuais/resumo.tex",
  "elementos-pre-textuais/abstract.tex",
  "elementos-pre-textuais/dedicatoria.tex",
  "elementos-pre-textuais/epigrafe.tex",
  "elementos-pre-textuais/agradecimentos.tex",
]);

export function isWysiwygEligible(path: string): boolean {
  if (!path.endsWith(".tex")) return false;
  if (path.startsWith("elementos-textuais/")) return true;
  if (path.startsWith("elementos-pos-textuais/apendices/")) return true;
  if (path.startsWith("elementos-pos-textuais/anexos/")) return true;
  return PROSE_PRE_TEXTUALS.has(path);
}

export type RailSection =
  | "root"
  | "preTextual"
  | "chapters"
  | "postTextual"
  | "library"
  | "figures";

export function railSectionOf(path: string): RailSection {
  if (path.startsWith("elementos-pre-textuais/")) return "preTextual";
  if (path.startsWith("elementos-textuais/")) return "chapters";
  if (path.startsWith("elementos-pos-textuais/")) return "postTextual";
  if (path.startsWith("lib/")) return "library";
  if (path.startsWith("figuras/")) return "figures";
  return "root";
}

/** Is this file locked to source view (avançado toggle)? (§4.1) */
export function isAdvancedOnly(path: string): boolean {
  return path.startsWith("lib/") || path === "documento.tex";
}
