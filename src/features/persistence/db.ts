/**
 * IndexedDB layout (§5.2): DB `uecetexlive`, stores projects / settings /
 * compile-cache. Every project read passes ProjectSchema.parse; corrupt
 * state is stashed (never silently lost) and the caller re-seeds.
 */
import { type IDBPDatabase, openDB } from "idb";
import {
  type CompileSettings,
  CompileSettingsSchema,
  type Project,
  ProjectSchema,
} from "@/features/project/schema";

const DB_NAME = "uecetexlive";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
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

export type LoadProjectResult =
  | { status: "ok"; project: Project }
  | { status: "missing" }
  | { status: "corrupt" };

export async function loadProject(id: string): Promise<LoadProjectResult> {
  const db = await getDb();
  const raw: unknown = await db.get("projects", id);
  if (raw === undefined) return { status: "missing" };
  const parsed = ProjectSchema.safeParse(raw);
  if (parsed.success) return { status: "ok", project: parsed.data };
  // Rescue: stash the corrupt blob so Phase-5 zip export can offer it back.
  await db.put("rescue", raw, `${id}@${Date.now()}`);
  return { status: "corrupt" };
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDb();
  await db.put("projects", project);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("projects", id);
}

export async function loadCompileSettings(): Promise<CompileSettings> {
  const db = await getDb();
  const raw: unknown = await db.get("settings", "compile");
  const parsed = CompileSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : CompileSettingsSchema.parse({});
}

export async function saveCompileSettings(settings: CompileSettings): Promise<void> {
  const db = await getDb();
  await db.put("settings", settings, "compile");
}

export interface CachedPdf {
  pdf: Uint8Array;
  passes: string[];
  timestamp: number;
}

export async function cacheLastPdf(entry: CachedPdf): Promise<void> {
  const db = await getDb();
  await db.put("compile-cache", entry, "last-pdf");
}

export async function loadLastPdf(): Promise<CachedPdf | undefined> {
  const db = await getDb();
  return (await db.get("compile-cache", "last-pdf")) as CachedPdf | undefined;
}
