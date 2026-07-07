/**
 * Editor resource resolution — how node views reach the project VFS and the
 * parsed bibliography without coupling the extensions to the store.
 */
import { createContext } from "react";

export interface BibEntry {
  key: string;
  author: string;
  title: string;
  year: string;
}

export interface EditorResources {
  /** Object URL for a VFS image path ("figuras/x.png"), or null if absent. */
  imageUrl: (path: string) => string | null;
  /** First N lines of a VFS text file, or null. */
  textFilePreview: (path: string, lines: number) => string | null;
  /** ABNT-style chip label for citation keys, e.g. "(SILVA, 2020)". */
  citationLabel: (keys: string[]) => string;
  /** All bibliography entries (for the picker). */
  bibEntries: BibEntry[];
  /** All known \label targets (for the crossref picker). */
  labels: string[];
  /** VFS image paths (figuras/*.png|jpg) for the figure picker. */
  imageFiles: string[];
  /** VFS code/text paths for the codeInclude picker. */
  codeFiles: string[];
  /**
   * Saves an uploaded image into figuras/ and returns its VFS path, or null
   * when rejected (unsupported type, too big, read-only context).
   */
  uploadImage: (file: File) => Promise<string | null>;
  /**
   * Free-text/DOI/ISBN search for the citation picker (v0.4 §2) — the app
   * decides how to route the query and normalizes results down to
   * BibEntry; this package never sees CSL-JSON, DOI, or any external API,
   * same boundary as bibEntries above.
   */
  searchCitations: (query: string) => Promise<BibEntry[]>;
  /**
   * Called when the user commits to inserting a search result identified by
   * `key` — returns the key to actually cite, letting the app resolve
   * dedup/collisions (e.g. the work is already in the library) before the
   * citation node is created.
   */
  confirmCitation: (key: string) => string;
}

export const emptyResources: EditorResources = {
  imageUrl: () => null,
  textFilePreview: () => null,
  citationLabel: (keys) => `(${keys.join("; ")})`,
  bibEntries: [],
  labels: [],
  imageFiles: [],
  codeFiles: [],
  uploadImage: async () => null,
  searchCitations: async () => [],
  confirmCitation: (key) => key,
};

export const EditorResourcesContext = createContext<EditorResources>(emptyResources);
