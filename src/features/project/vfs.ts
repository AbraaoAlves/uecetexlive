/**
 * Adapter do app: liga as funções genéricas do @papyru/project-model à
 * estrutura do uecetex2. Os call sites do app seguem com assinaturas por path.
 */
import {
  isAdvancedOnly as genericIsAdvancedOnly,
  isSimpleModeVisible as genericIsSimpleModeVisible,
  isWysiwygEligible as genericIsWysiwygEligible,
  railSectionOf as genericRailSectionOf,
  type RailSection,
  UECETEX2_STRUCTURE,
} from "@papyru/project-model";

export { bytesToText, kindOf, textToBytes } from "@papyru/project-model";
export type { RailSection };

export const isWysiwygEligible = (path: string): boolean =>
  genericIsWysiwygEligible(UECETEX2_STRUCTURE, path);

export const railSectionOf = (path: string): RailSection =>
  genericRailSectionOf(UECETEX2_STRUCTURE, path);

export const isAdvancedOnly = (path: string): boolean =>
  genericIsAdvancedOnly(UECETEX2_STRUCTURE, path);

export const isSimpleModeVisible = (path: string): boolean =>
  genericIsSimpleModeVisible(UECETEX2_STRUCTURE, path);

/**
 * Qual edição visual este arquivo tem, se tiver alguma. "prose" é o editor
 * WYSIWYG dos capítulos; "bib" é a lista de referências, que vale para
 * qualquer .bib do projeto — cada um edita o seu.
 */
export type VisualMode = "prose" | "bib";

export function visualModeFor(
  file: { path: string; kind: string } | null | undefined,
): VisualMode | null {
  if (!file) return null;
  if (file.kind === "bib") return "bib";
  if (file.kind === "tex" && isWysiwygEligible(file.path)) return "prose";
  return null;
}
