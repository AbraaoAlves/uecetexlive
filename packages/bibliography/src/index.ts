// Barrel único (ADR-06, docs/decisions.md), como latex-mapping/project-model.
export { parseBibFile, serializeBibFile, serializeEntry } from "./domain/bib-file";
export { buildCitationKey, type CitationKeySource } from "./domain/citation-key";
export {
  type AddEntryResult,
  addEntry,
  removeEntry,
  renameKey,
  updateEntry,
} from "./domain/commands";
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
export { type SearchOptions, searchReferences } from "./search/reference-search";
export { candidateToNewEntryInput, escapeBibtex } from "./search/to-bibtex";
export type {
  CandidateAuthor,
  ProviderFailure,
  ProviderId,
  ReferenceCandidate,
  SearchResult,
} from "./search/types";
