/**
 * VFS helpers — pure functions over project file paths and bytes (§3.8, §4.1).
 * Binary fidelity rule: Uint8Array end-to-end; text conversion only at the
 * editor boundary, via TextEncoder/TextDecoder (UTF-8).
 *
 * As regras que dependem do layout do template recebem um TemplateStructure —
 * nada aqui conhece o uecetex2 (que vive em UECETEX2_STRUCTURE).
 */
import type { FileKind } from "./schema";
import { matchesAnyGlob, type TemplateStructure } from "./template-structure";

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

/** WYSIWYG-editable prose (§4.1 item 4) — globs do template decidem. */
export function isWysiwygEligible(structure: TemplateStructure, path: string): boolean {
  return matchesAnyGlob(structure.wysiwygEligible, path);
}

export function railSectionOf<Id extends string>(
  structure: TemplateStructure<Id>,
  path: string,
): Id | "root" {
  for (const section of structure.sections) {
    if (matchesAnyGlob(section.globs, path)) return section.id;
  }
  return "root";
}

/** Is this file locked to source view (avançado toggle)? (§4.1) */
export function isAdvancedOnly(structure: TemplateStructure, path: string): boolean {
  return matchesAnyGlob(structure.advancedOnly, path);
}

/**
 * Visible in the rail with "Avançado" off: only what a Perfil-A student
 * writes — prose, plus whatever o template lista em simpleModeVisible
 * (bibliografia, figuras). Structural files stay hidden.
 */
export function isSimpleModeVisible(structure: TemplateStructure, path: string): boolean {
  if (isWysiwygEligible(structure, path)) return true;
  return matchesAnyGlob(structure.simpleModeVisible, path);
}
