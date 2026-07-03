/**
 * Project state — load-or-seed on boot, 500 ms debounced autosave (§5.2).
 */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { loadProject, saveProject } from "@/features/persistence/db";
import type { Project } from "./schema";
import { seedTemplate } from "./seed";
import { textToBytes } from "./vfs";

const PROJECT_ID = "uecetex2";
const AUTOSAVE_MS = 500;

export type SaveState = "saved" | "saving";

interface ProjectStore {
  project: Project | null;
  loading: boolean;
  loadError: string | null;
  wasRescued: boolean;
  currentPath: string | null;
  saveState: SaveState;
  dirtyPaths: ReadonlySet<string>;
  openFile: (path: string) => void;
  updateFileText: (path: string, text: string) => void;
  updateFileBytes: (path: string, bytes: Uint8Array) => void;
  replaceProject: (project: Project) => void;
}

const ProjectContext = createContext<ProjectStore | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wasRescued, setWasRescued] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [dirtyPaths, setDirtyPaths] = useState<ReadonlySet<string>>(new Set());

  const projectRef = useRef<Project | null>(null);
  projectRef.current = project;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await loadProject(PROJECT_ID);
        let loaded: Project;
        if (result.status === "ok") {
          loaded = result.project;
        } else {
          if (result.status === "corrupt") setWasRescued(true);
          loaded = await seedTemplate();
          await saveProject(loaded);
        }
        if (cancelled) return;
        setProject(loaded);
        setCurrentPath(
          loaded.files.find((f) => f.path === "elementos-textuais/introducao.tex")
            ?.path ??
            loaded.files.find((f) => f.kind === "tex")?.path ??
            null,
        );
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const schedulePersist = useCallback(() => {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const current = projectRef.current;
      if (!current) return;
      await saveProject(current);
      setSaveState("saved");
      setDirtyPaths(new Set());
    }, AUTOSAVE_MS);
  }, []);

  const updateFileBytes = useCallback(
    (path: string, bytes: Uint8Array) => {
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          updatedAt: Date.now(),
          files: prev.files.map((f) => (f.path === path ? { ...f, bytes } : f)),
        };
      });
      setDirtyPaths((prev) => new Set(prev).add(path));
      schedulePersist();
    },
    [schedulePersist],
  );

  const updateFileText = useCallback(
    (path: string, text: string) => updateFileBytes(path, textToBytes(text)),
    [updateFileBytes],
  );

  const replaceProject = useCallback(
    (next: Project) => {
      setProject(next);
      setDirtyPaths(new Set());
      schedulePersist();
    },
    [schedulePersist],
  );

  const value = useMemo<ProjectStore>(
    () => ({
      project,
      loading,
      loadError,
      wasRescued,
      currentPath,
      saveState,
      dirtyPaths,
      openFile: setCurrentPath,
      updateFileText,
      updateFileBytes,
      replaceProject,
    }),
    [
      project,
      loading,
      loadError,
      wasRescued,
      currentPath,
      saveState,
      dirtyPaths,
      updateFileText,
      updateFileBytes,
      replaceProject,
    ],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectStore {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject requires <ProjectProvider>");
  return ctx;
}
