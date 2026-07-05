/**
 * IndexedDB layout (§5.2): stores projects / settings / compile-cache.
 * Every project read passes ProjectSchema.parse; corrupt state is stashed
 * (never silently lost) and the caller re-seeds.
 *
 * O nome do banco é decisão do app consumidor — createProjectDb(dbName).
 */
import { type IDBPDatabase, openDB } from "idb";
import {
  type CompileSettings,
  CompileSettingsSchema,
  type Project,
  ProjectSchema,
  type UiSettings,
  UiSettingsSchema,
} from "./schema";

const DB_VERSION = 1;

export type LoadProjectResult =
  | { status: "ok"; project: Project }
  | { status: "missing" }
  | { status: "corrupt" };

export interface CachedPdf {
  pdf: Uint8Array;
  passes: string[];
  timestamp: number;
}

export interface ProjectDb {
  loadProject(id: string): Promise<LoadProjectResult>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
  loadCompileSettings(): Promise<CompileSettings>;
  saveCompileSettings(settings: CompileSettings): Promise<void>;
  loadUiSettings(): Promise<UiSettings>;
  saveUiSettings(settings: UiSettings): Promise<void>;
  cacheLastPdf(entry: CachedPdf): Promise<void>;
  loadLastPdf(): Promise<CachedPdf | undefined>;
}

export function createProjectDb(dbName: string): ProjectDb {
  let dbPromise: Promise<IDBPDatabase> | null = null;

  function getDb(): Promise<IDBPDatabase> {
    if (typeof indexedDB === "undefined") {
      return Promise.reject(new Error("IndexedDB unavailable"));
    }
    dbPromise ??= openDB(dbName, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings");
        }
        if (!db.objectStoreNames.contains("compile-cache")) {
          db.createObjectStore("compile-cache");
        }
        if (!db.objectStoreNames.contains("rescue")) {
          db.createObjectStore("rescue");
        }
      },
    });
    return dbPromise;
  }

  return {
    async loadProject(id) {
      const db = await getDb();
      const raw: unknown = await db.get("projects", id);
      if (raw === undefined) return { status: "missing" };
      const parsed = ProjectSchema.safeParse(raw);
      if (parsed.success) return { status: "ok", project: parsed.data };
      // Rescue: stash the corrupt blob so Phase-5 zip export can offer it back.
      await db.put("rescue", raw, `${id}@${Date.now()}`);
      return { status: "corrupt" };
    },

    async saveProject(project) {
      const db = await getDb();
      await db.put("projects", project);
    },

    async deleteProject(id) {
      const db = await getDb();
      await db.delete("projects", id);
    },

    async loadCompileSettings() {
      const db = await getDb();
      const raw: unknown = await db.get("settings", "compile");
      const parsed = CompileSettingsSchema.safeParse(raw ?? {});
      return parsed.success ? parsed.data : CompileSettingsSchema.parse({});
    },

    async saveCompileSettings(settings) {
      const db = await getDb();
      await db.put("settings", settings, "compile");
    },

    async loadUiSettings() {
      const db = await getDb();
      const raw: unknown = await db.get("settings", "ui");
      const parsed = UiSettingsSchema.safeParse(raw ?? {});
      return parsed.success ? parsed.data : UiSettingsSchema.parse({});
    },

    async saveUiSettings(settings) {
      const db = await getDb();
      await db.put("settings", settings, "ui");
    },

    async cacheLastPdf(entry) {
      const db = await getDb();
      await db.put("compile-cache", entry, "last-pdf");
    },

    async loadLastPdf() {
      const db = await getDb();
      return (await db.get("compile-cache", "last-pdf")) as CachedPdf | undefined;
    },
  };
}
