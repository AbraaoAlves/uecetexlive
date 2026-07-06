/**
 * Adapter do app: banco IndexedDB `uecetexlive` (§5.2) sobre o factory do
 * @papyru/project-model — o nome do banco é configuração deste app.
 */
import {
  type CachedPdf,
  createProjectDb,
  type LoadProjectResult,
} from "@papyru/project-model";

export type { CachedPdf, LoadProjectResult };

const db = createProjectDb("uecetexlive");

export const {
  loadProject,
  saveProject,
  deleteProject,
  loadCompileSettings,
  saveCompileSettings,
  loadUiSettings,
  saveUiSettings,
  cacheLastPdf,
  loadLastPdf,
} = db;
