// Barrel único (ADR-06 — UI_UX_PLAN §7), como latex-mapping/project-model.
export { parseBibFile, serializeBibFile, serializeEntry } from "./domain/bib-file";
export { buildCitationKey, type CitationKeySource } from "./domain/citation-key";
export { addEntry, removeEntry, renameKey, updateEntry } from "./domain/commands";
export {
  ENTRY_FIELD_SPECS,
  ENTRY_TYPE_LABELS_PT,
  type FieldSpec,
  missingRequiredFields,
} from "./domain/entry-schema";
export {
  type BibFieldValue,
  type BibFile,
  type BibliographyEntry,
  bracedField,
  type Chunk,
  type DomainError,
  ENTRY_TYPES,
  type EntryPatch,
  type EntryType,
  type EntryTypeTag,
  entryTypeName,
  err,
  fieldText,
  isKnownEntryType,
  isParseFailure,
  type NewEntryInput,
  ok,
  type ParseFailure,
  type Result,
} from "./domain/types";
