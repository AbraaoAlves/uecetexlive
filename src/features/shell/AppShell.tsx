import { Download, FileUp, Loader2, Menu, RotateCcw } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useCompile } from "@/features/compiler/useCompile";
import { SourceEditor } from "@/features/editor/SourceEditor";
import { useEditorResources } from "@/features/editor/useEditorResources";
import { deleteProject } from "@/features/persistence/db";
import { LogPane } from "@/features/preview/LogPane";
import { PdfPane } from "@/features/preview/PdfPane";
import { buildIncludeGraph } from "@/features/project/include-graph";
import { rewriteInputOrder } from "@/features/project/reorder";
import { seedTemplate } from "@/features/project/seed";
import { ProjectProvider, useProject } from "@/features/project/store";
import {
  bytesToText,
  isAdvancedOnly,
  isWysiwygEligible,
  type RailSection,
  railSectionOf,
} from "@/features/project/vfs";
import { exportProjectZip, importProjectZip } from "@/features/project/zip";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { CompileButton } from "./CompileButton";
import { EngineToggle } from "./EngineToggle";
import { ImportDialog, type ImportDialogState } from "./ImportDialog";
import { ProjectRail, type RailFile } from "./ProjectRail";
import { TopBar } from "./TopBar";
import { WarmupProgress } from "./WarmupProgress";

// Tiptap + KaTeX are the bulk of the JS (§11.5) — keep them out of the app
// shell chunk; the WYSIWYG surface streams in on first use.
const EditorSurface = lazy(() =>
  import("@/features/editor/EditorSurface").then((m) => ({
    default: m.EditorSurface,
  })),
);

const SECTION_RANK: Record<RailSection, number> = {
  root: 0,
  preTextual: 1,
  chapters: 2,
  postTextual: 3,
  library: 4,
  figures: 5,
};

/**
 * Three-pane shell (§6.1): rail 240px / editor flex / preview 45%.
 */
export function AppShell() {
  return (
    <ProjectProvider>
      <ShellInner />
    </ProjectProvider>
  );
}

function ShellInner() {
  const {
    project,
    loading,
    loadError,
    currentPath,
    saveState,
    dirtyPaths,
    openFile,
    updateFileText,
    replaceProject,
    createFile,
  } = useProject();
  const [advanced, setAdvanced] = useState(false);
  const [previewTab, setPreviewTab] = useState<"pdf" | "log">("pdf");
  const [sourceView, setSourceView] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importState, setImportState] = useState<
    (ImportDialogState & { payload?: unknown }) | null
  >(null);
  const [precompiledBbl, setPrecompiledBbl] = useState<Uint8Array | undefined>();
  const zipInputRef = useRef<HTMLInputElement>(null);
  const bblInputRef = useRef<HTMLInputElement>(null);
  const { state: compileState, compile, setEngine } = useCompile();

  const texSources = useMemo(() => {
    const map: Record<string, string> = {};
    if (!project) return map;
    for (const f of project.files) {
      if (f.kind === "tex") map[f.path] = bytesToText(f.bytes);
    }
    return map;
  }, [project]);

  const graph = useMemo(
    () =>
      project
        ? buildIncludeGraph(texSources, project.entry)
        : { inputs: [], labels: [], bibliography: null, bibliographyStyle: null },
    [project, texSources],
  );

  const railFiles = useMemo<RailFile[]>(() => {
    if (!project) return [];
    const graphRank = new Map<string, number>();
    graph.inputs.forEach((input, i) => {
      if (input.resolved) graphRank.set(input.resolved, i);
    });
    return project.files
      .map((f) => ({
        path: f.path,
        dirty: dirtyPaths.has(f.path),
        locked: isAdvancedOnly(f.path) && !advanced,
      }))
      .sort((a, b) => {
        const sa = SECTION_RANK[railSectionOf(a.path)];
        const sb = SECTION_RANK[railSectionOf(b.path)];
        if (sa !== sb) return sa - sb;
        const ga = graphRank.get(a.path) ?? Number.MAX_SAFE_INTEGER;
        const gb = graphRank.get(b.path) ?? Number.MAX_SAFE_INTEGER;
        if (ga !== gb) return ga - gb;
        return a.path.localeCompare(b.path);
      });
  }, [project, graph, dirtyPaths, advanced]);

  const missingIncludes = useMemo(
    () => graph.inputs.filter((i) => i.resolved === null).map((i) => i.path),
    [graph],
  );

  const currentFile = project?.files.find((f) => f.path === currentPath) ?? null;
  const resources = useEditorResources(project, graph);

  const wysiwygCapable =
    currentFile !== null &&
    currentFile.kind === "tex" &&
    isWysiwygEligible(currentFile.path);
  const showWysiwyg = wysiwygCapable && !sourceView;

  const projectRefForKeys = useRef(project);
  projectRefForKeys.current = project;

  // Mod-e toggles WYSIWYG ⇄ source; Mod-Enter compiles (§4.5).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "e") {
        e.preventDefault();
        setSourceView((v) => !v);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const current = projectRefForKeys.current;
        if (current) {
          setPreviewTab("pdf");
          void compile(current);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compile]);

  const download = (name: string, bytes: Uint8Array, mime: string) => {
    const copy = new Uint8Array(bytes);
    const url = URL.createObjectURL(
      new Blob([copy.buffer as ArrayBuffer], { type: mime }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleZipFile = async (file: File) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const imported = await importProjectZip(bytes, "uecetex2");
      setImportState({
        kind: "zip-ok",
        fileCount: imported.files.length,
        entry: imported.entry,
        payload: imported,
      });
    } catch (err) {
      setImportState({ kind: "zip-error", message: (err as Error).message });
    }
  };

  const handleBblFile = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    setImportState({ kind: "bbl-ok", sizeBytes: bytes.length, payload: bytes });
  };

  const confirmImport = () => {
    if (!importState) return;
    if (importState.kind === "zip-ok") {
      replaceProject(importState.payload as never);
      openFile("documento.tex");
    } else if (importState.kind === "bbl-ok") {
      setPrecompiledBbl(importState.payload as Uint8Array);
    }
    setImportState(null);
  };

  const resetTemplate = async () => {
    if (!window.confirm("Restaurar o modelo original? Suas alterações serão perdidas."))
      return;
    await deleteProject("uecetex2");
    const fresh = await seedTemplate();
    replaceProject(fresh);
    setPrecompiledBbl(undefined);
  };

  const handleSelect = (path: string) => {
    const exists = project?.files.some((f) => f.path === path);
    if (exists) {
      openFile(path);
      return;
    }
    // Missing include (§5.3): one-click create.
    const target = path.endsWith(".tex") ? path : `${path}.tex`;
    if (window.confirm(`Criar ${target}?`)) {
      createFile(target, new TextEncoder().encode(""));
    }
  };

  const reorderChapters = (from: string, to: string) => {
    if (!project) return;
    const docFile = project.files.find((f) => f.path === project.entry);
    if (!docFile) return;
    const chapters = graph.inputs
      .filter((i) => i.resolved?.startsWith("elementos-textuais/"))
      .map((i) => i.path);
    const fromTarget = from.replace(/\.tex$/, "");
    const toTarget = to.replace(/\.tex$/, "");
    const without = chapters.filter((c) => c !== fromTarget);
    const insertAt = without.indexOf(toTarget);
    if (insertAt === -1 || !chapters.includes(fromTarget)) return;
    const next = [...without.slice(0, insertAt), fromTarget, ...without.slice(insertAt)];
    if (!window.confirm("Reordenar capítulos? O documento.tex será reescrito.")) return;
    try {
      const rewritten = rewriteInputOrder(bytesToText(docFile.bytes), chapters, next);
      updateFileText(project.entry, rewritten);
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-ink-muted">
        <Loader2 className="size-5 animate-spin" />
        {strings.app.name}
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-danger">
        {loadError ?? "Projeto indisponível"}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="app-shell">
      <TopBar projectName={project.name} saveState={saveState}>
        <label className="flex items-center gap-1.5 text-ink-muted text-xs">
          <input
            type="checkbox"
            checked={advanced}
            onChange={(e) => setAdvanced(e.target.checked)}
          />
          Avançado
        </label>
        {compileState.status === "warming" && compileState.warmup && (
          <WarmupProgress {...compileState.warmup} />
        )}
        <EngineToggle
          engine={compileState.engine}
          fullReady={false}
          onChange={setEngine}
        />
        <CompileButton
          status={compileState.status}
          progressLabel={compileState.progress?.label}
          onCompile={() => {
            setPreviewTab("pdf");
            void compile(project, { precompiledBbl });
          }}
        />
        <button
          type="button"
          data-testid="export-pdf"
          title={strings.topbar.exportPdf}
          disabled={!compileState.result?.pdf}
          className="rounded p-1.5 text-ink-muted hover:bg-accent-soft disabled:opacity-40"
          onClick={() => {
            const pdf = compileState.result?.pdf;
            if (pdf) download("documento.pdf", pdf, "application/pdf");
          }}
        >
          <Download className="size-4" />
        </button>
        <div className="relative">
          <button
            type="button"
            data-testid="menu-button"
            title={strings.topbar.menu}
            className="rounded p-1.5 text-ink-muted hover:bg-accent-soft"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Menu className="size-4" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border bg-surface-elevated py-1 text-sm shadow-lg"
              data-testid="app-menu"
            >
              <MenuItem
                testid="menu-export-zip"
                onClick={() => {
                  setMenuOpen(false);
                  download(
                    `${project.name}.zip`,
                    exportProjectZip(project),
                    "application/zip",
                  );
                }}
              >
                <Download className="size-3.5" /> {strings.topbar.exportZip}
              </MenuItem>
              <MenuItem
                testid="menu-import-zip"
                onClick={() => {
                  setMenuOpen(false);
                  zipInputRef.current?.click();
                }}
              >
                <FileUp className="size-3.5" /> {strings.topbar.importZip}
              </MenuItem>
              <MenuItem
                testid="menu-import-bbl"
                onClick={() => {
                  setMenuOpen(false);
                  bblInputRef.current?.click();
                }}
              >
                <FileUp className="size-3.5" /> {strings.topbar.importBbl}
                {precompiledBbl && (
                  <span
                    className="ml-auto rounded bg-accent-soft px-1 text-[10px]"
                    data-testid="bbl-badge"
                  >
                    ativo
                  </span>
                )}
              </MenuItem>
              <MenuItem
                testid="menu-reset"
                onClick={() => {
                  setMenuOpen(false);
                  void resetTemplate();
                }}
              >
                <RotateCcw className="size-3.5" /> {strings.topbar.resetTemplate}
              </MenuItem>
            </div>
          )}
        </div>
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          data-testid="zip-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleZipFile(file);
            e.target.value = "";
          }}
        />
        <input
          ref={bblInputRef}
          type="file"
          accept=".bbl"
          className="hidden"
          data-testid="bbl-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleBblFile(file);
            e.target.value = "";
          }}
        />
      </TopBar>
      <div className="flex min-h-0 flex-1">
        <aside
          className="w-60 shrink-0 overflow-y-auto border-r bg-surface"
          data-testid="project-rail"
        >
          <ProjectRail
            files={railFiles}
            currentPath={currentPath}
            missingIncludes={missingIncludes}
            onSelect={handleSelect}
            onReorderChapters={reorderChapters}
          />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col" data-testid="editor-pane">
          {wysiwygCapable && (
            <div className="flex h-8 shrink-0 items-center justify-end gap-1 border-b bg-surface px-2 text-xs">
              <button
                type="button"
                data-testid="view-toggle"
                className="rounded px-2 py-0.5 text-ink-muted hover:bg-accent-soft"
                title="Mod+E"
                onClick={() => setSourceView((v) => !v)}
              >
                {showWysiwyg ? strings.editor.sourceView : strings.editor.wysiwygView}
              </button>
            </div>
          )}
          {currentFile ? (
            currentFile.kind === "image" || currentFile.kind === "pdf" ? (
              <BinaryPreview
                path={currentFile.path}
                bytes={currentFile.bytes}
                kind={currentFile.kind}
              />
            ) : showWysiwyg ? (
              <Suspense
                fallback={
                  <div className="flex flex-1 items-center justify-center text-ink-subtle">
                    <Loader2 className="size-4 animate-spin" />
                  </div>
                }
              >
                <EditorSurface
                  path={currentFile.path}
                  source={bytesToText(currentFile.bytes)}
                  resources={resources}
                  onChange={(text) => updateFileText(currentFile.path, text)}
                />
              </Suspense>
            ) : (
              <SourceEditor
                path={currentFile.path}
                text={bytesToText(currentFile.bytes)}
                readOnly={isAdvancedOnly(currentFile.path) && !advanced}
                onChange={(text) => updateFileText(currentFile.path, text)}
              />
            )
          ) : (
            <div className="flex flex-1 items-center justify-center text-ink-subtle">
              {strings.editor.placeholder}
            </div>
          )}
        </main>
        <section
          className="flex w-[45%] shrink-0 flex-col border-l bg-surface"
          data-testid="preview-pane"
        >
          <div className="flex h-9 shrink-0 items-center gap-1 border-b px-2 text-xs">
            <button
              type="button"
              data-testid="preview-tab-pdf"
              onClick={() => setPreviewTab("pdf")}
              className={cn(
                "rounded px-2 py-1",
                previewTab === "pdf" ? "bg-accent-soft font-medium" : "text-ink-muted",
              )}
            >
              {strings.preview.pdfTab}
            </button>
            <button
              type="button"
              data-testid="preview-tab-log"
              onClick={() => setPreviewTab("log")}
              className={cn(
                "rounded px-2 py-1",
                previewTab === "log" ? "bg-accent-soft font-medium" : "text-ink-muted",
              )}
            >
              {strings.preview.logTab}
            </button>
            {compileState.error && (
              <span className="ml-2 truncate text-danger">{compileState.error}</span>
            )}
          </div>
          <div className="min-h-0 flex-1">
            {previewTab === "pdf" ? (
              <PdfPane
                pdf={compileState.result?.pdf ?? null}
                compiling={compileState.status === "compiling"}
              />
            ) : (
              <LogPane
                log={compileState.result?.log ?? compileState.error ?? ""}
                diagnostics={compileState.result?.diagnostics ?? []}
                draftMode={
                  compileState.engine === "swiftlatex-draft" &&
                  compileState.result !== null
                }
              />
            )}
          </div>
        </section>
      </div>
      {importState && (
        <ImportDialog
          state={importState}
          onConfirm={confirmImport}
          onClose={() => setImportState(null)}
        />
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  testid,
}: {
  children: React.ReactNode;
  onClick: () => void;
  testid: string;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent-soft"
    >
      {children}
    </button>
  );
}

function BinaryPreview({
  path,
  bytes,
  kind,
}: {
  path: string;
  bytes: Uint8Array;
  kind: "image" | "pdf";
}) {
  const url = useMemo(() => {
    const ext = path.split(".").pop()?.toLowerCase();
    const mime =
      kind === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
    const copy = new Uint8Array(bytes);
    return URL.createObjectURL(new Blob([copy.buffer as ArrayBuffer], { type: mime }));
  }, [bytes, kind, path]);

  if (kind === "image") {
    return (
      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        <img src={url} alt={path} className="max-h-full max-w-full shadow" />
      </div>
    );
  }
  return <iframe src={url} title={path} className="h-full w-full flex-1 border-0" />;
}
