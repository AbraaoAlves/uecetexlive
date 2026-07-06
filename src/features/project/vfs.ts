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
