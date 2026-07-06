import { SourceEditor, useEditorResources } from "@uecetexlive/editor";
import { LogPane, PdfPane } from "@uecetexlive/editor/preview";
import {
  countLatexWords,
  exportProjectZip,
  importProjectZip,
  UECETEX2_STRUCTURE,
} from "@uecetexlive/project-model";
import {
  Download,
  FileUp,
  Loader2,
  Menu,
  PanelLeft,
  PanelLeftClose,
  RotateCcw,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCompile } from "@/features/compiler/useCompile";
import { useIdleWarmup } from "@/features/compiler/useIdleWarmup";
import { MetadataWizard } from "@/features/metadata/MetadataWizard";
import { WelcomeDialog } from "@/features/metadata/WelcomeDialog";
import { deleteProject } from "@/features/persistence/db";
import { buildIncludeGraph, type IncludeGraph } from "@/features/project/include-graph";
import {
  applyMetadata,
  extractMetadata,
  TEMPLATE_PLACEHOLDER_TITLE,
} from "@/features/project/metadata";
import { chapterScaffold, insertChapterInput } from "@/features/project/new-chapter";
import { rewriteInputOrder } from "@/features/project/reorder";
import { seedTemplate } from "@/features/project/seed";
import { ProjectProvider, useProject } from "@/features/project/store";
import { useTemplateUpdateNotice } from "@/features/project/useTemplateUpdateNotice";
import {
  bytesToText,
  isAdvancedOnly,
  isSimpleModeVisible,
  isWysiwygEligible,
  type RailSection,
  railSectionOf,
  textToBytes,
} from "@/features/project/vfs";
import { strings } from "@/lib/strings";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn, slugify } from "@/lib/utils";
import { CompileButton } from "./CompileButton";
import { EngineToggle } from "./EngineToggle";
import { IdleWarmupIndicator } from "./IdleWarmupIndicator";
import { ImportDialog, type ImportDialogState } from "./ImportDialog";
import { NewChapterDialog } from "./NewChapterDialog";
import { ProjectRail, type RailFile } from "./ProjectRail";
import { TemplateUpdateBanner } from "./TemplateUpdateBanner";
import { ThemeToggle } from "./ThemeToggle";
import { Tooltip } from "./Tooltip";
import { TopBar } from "./TopBar";
import { useTheme } from "./useTheme";
import { useUiSettings } from "./useUiSettings";
import { WarmupProgress } from "./WarmupProgress";

// Tiptap + KaTeX are the bulk of the JS (§11.5) — keep them out of the app
// shell chunk; the WYSIWYG surface streams in on first use.
const EditorSurface = lazy(() =>
  import("@uecetexlive/editor").then((m) => ({
    default: m.EditorSurface,
  })),
);

/** Settle window for keystroke-heavy derivations (graph, total word count). */
const DERIVED_MS = 300;
const EMPTY_GRAPH: IncludeGraph = {
  inputs: [],
  labels: [],
  bibliography: null,
  bibliographyStyle: null,
};

const SECTION_RANK: Record<RailSection, number> = {
  root: 0,
  preTextual: 1,
  chapters: 2,
  postTextual: 3,
  library: 4,
  figures: 5,
};

/** Rail upload allowlist (QA §A4) — mirrors kindOf's image/pdf/code sets. */
const RAIL_UPLOAD_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "pdf",
  "cpp",
  "c",
  "h",
  "java",
  "py",
  "js",
  "ts",
]);
const RAIL_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

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
  const { ui, setUi, ready: uiReady } = useUiSettings();
  const advanced = ui.advancedMode;
  const railCollapsed = ui.railCollapsed;
  useTheme(ui.theme, uiReady);
  const { latestCommit: templateUpdateCommit } = useTemplateUpdateNotice(
    project?.templateCommit,
  );
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [newChapterOpen, setNewChapterOpen] = useState(false);
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
  const idleWarmup = useIdleWarmup();

  const texSources = useMemo(() => {
    const map: Record<string, string> = {};
    if (!project) return map;
    for (const f of project.files) {
      if (f.kind === "tex") map[f.path] = bytesToText(f.bytes);
    }
    return map;
  }, [project]);

  // Heavy derivations (unified-latex include graph, whole-work word count)
  // cost ~150 ms on the stock template and must not run per keystroke
  // (QA rodada 4 §R4). They key on a debounced copy; per-keystroke reads
  // (entrySource, currentWords) stay on the live map. Staleness is bounded
  // by DERIVED_MS and every writer (createChapter, reorderChapters,
  // applyWorkMetadata) splices the *live* source, never the graph.
  const settledTexSources = useDebouncedValue(texSources, DERIVED_MS);
  // Boot flush: the debounced copy starts empty and only catches up 300 ms
  // after the project loads. Deriving from it that early makes the rail
  // order/labels pop in late and flips the node-view context identity while
  // the student may already be typing (lost-keystroke e2e flake). Until the
  // debounce has caught up once, derive from the live map.
  const derivedTexSources =
    Object.keys(settledTexSources).length > 0 ? settledTexSources : texSources;
  const entryPath = project?.entry ?? null;
  const graph = useMemo(
    () => (entryPath ? buildIncludeGraph(derivedTexSources, entryPath) : EMPTY_GRAPH),
    [derivedTexSources, entryPath],
  );

  const visibleFiles = useMemo(() => {
    if (!project) return [];
    return advanced
      ? project.files
      : project.files.filter((f) => isSimpleModeVisible(f.path));
  }, [project, advanced]);
  const hiddenCount = project ? project.files.length - visibleFiles.length : 0;

  const railFiles = useMemo<RailFile[]>(() => {
    const graphRank = new Map<string, number>();
    graph.inputs.forEach((input, i) => {
      if (input.resolved) graphRank.set(input.resolved, i);
    });
    return visibleFiles
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
  }, [visibleFiles, graph, dirtyPaths, advanced]);

  const missingIncludes = useMemo(
    () => graph.inputs.filter((i) => i.resolved === null).map((i) => i.path),
    [graph],
  );

  const setAdvanced = useCallback(
    (v: boolean) => {
      setUi({ advancedMode: v });
      // Leaving advanced mode may hide the open file — land on prose instead.
      if (!v && currentPath && !isSimpleModeVisible(currentPath)) {
        const fallback =
          project?.files.find((f) => f.path === "elementos-textuais/introducao.tex") ??
          project?.files.find((f) => isSimpleModeVisible(f.path));
        if (fallback) openFile(fallback.path);
      }
    },
    [setUi, currentPath, project, openFile],
  );

  const railToggleRef = useRef<HTMLButtonElement>(null);
  const railCollapsedRef = useRef(railCollapsed);
  railCollapsedRef.current = railCollapsed;
  const toggleRail = useCallback(() => {
    const collapsing = !railCollapsedRef.current;
    setUi({ railCollapsed: collapsing });
    // `inert` drops focus from inside the collapsed rail — keep it reachable.
    if (collapsing) railToggleRef.current?.focus();
  }, [setUi]);

  const currentFile = project?.files.find((f) => f.path === currentPath) ?? null;
  // Uploaded images land in the VFS without stealing the open editor.
  const addImageFile = useCallback(
    (path: string, bytes: Uint8Array) => createFile(path, bytes, { open: false }),
    [createFile],
  );
  const resources = useEditorResources(project, graph, addImageFile);

  // Rail upload (QA §A4): images, PDFs and code files land in figuras/ —
  // the template's own convention (main.cpp lives there).
  const handleRailUpload = async (uploads: File[]) => {
    if (!project) return;
    const claimed = new Set(project.files.map((f) => f.path));
    const rejected: string[] = [];
    for (const file of uploads) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (
        !RAIL_UPLOAD_EXTENSIONS.has(ext) ||
        file.size === 0 ||
        file.size > RAIL_UPLOAD_MAX_BYTES
      ) {
        rejected.push(file.name);
        continue;
      }
      const base = slugify(file.name.replace(/\.[^.]*$/, "")) || "arquivo";
      let path = `figuras/${base}.${ext}`;
      for (let n = 2; claimed.has(path); n++) {
        path = `figuras/${base}-${n}.${ext}`;
      }
      claimed.add(path);
      createFile(path, new Uint8Array(await file.arrayBuffer()), { open: false });
    }
    if (rejected.length) {
      window.alert(`${strings.rail.uploadFileError} ${rejected.join(", ")}`);
    }
  };

  // Depends on the entry's *string* (not `project`): texSources rebuilds per
  // keystroke, but equal content yields the same primitive → memo holds.
  const entrySource = project ? (texSources[project.entry] ?? "") : "";
  const meta = useMemo(() => extractMetadata(entrySource), [entrySource]);
  const workTitle = meta.get("titulo")?.value.trim() ?? "";
  const metadataPending = workTitle === "" || workTitle === TEMPLATE_PLACEHOLDER_TITLE;

  const applyWorkMetadata = useCallback(
    (updates: Map<string, string>) => {
      if (!project) return;
      updateFileText(project.entry, applyMetadata(entrySource, updates));
    },
    [project, entrySource, updateFileText],
  );

  const wysiwygCapable =
    currentFile !== null &&
    currentFile.kind === "tex" &&
    isWysiwygEligible(currentFile.path);
  const showWysiwyg = wysiwygCapable && !sourceView;

  // Word count (QA Fase 1): current prose file + whole work. The current-file
  // memo keys on the source *string*, so it holds while typing elsewhere.
  const currentProseSource =
    wysiwygCapable && currentPath ? (texSources[currentPath] ?? "") : "";
  const currentWords = useMemo(
    () => countLatexWords(currentProseSource),
    [currentProseSource],
  );
  const totalWords = useMemo(() => {
    let sum = 0;
    for (const [path, src] of Object.entries(derivedTexSources)) {
      if (isWysiwygEligible(path)) sum += countLatexWords(src);
    }
    return sum;
  }, [derivedTexSources]);

  // Escape closes the app menu regardless of where focus sits (QA §M4).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const projectRefForKeys = useRef(project);
  projectRefForKeys.current = project;

  // Mod-e toggles WYSIWYG ⇄ source; Mod-Enter compiles (§4.5); Mod-b rail.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "e") {
        e.preventDefault();
        setSourceView((v) => !v);
      } else if (e.key === "b") {
        // Inside an editable surface Mod+B belongs to the editor (Tiptap bold).
        const target = e.target as HTMLElement | null;
        if (target?.closest?.('[contenteditable="true"], textarea, input')) return;
        e.preventDefault();
        toggleRail();
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
  }, [compile, toggleRail]);

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
      const imported = await importProjectZip(bytes, "uecetex2", {
        structure: UECETEX2_STRUCTURE,
        templateSource: "https://github.com/thiagodnf/uecetex2",
        preferredEntry: "documento.tex",
      });
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
    setMetadataOpen(false);
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

  const createChapter = (title: string) => {
    if (!project) return;
    const slug = slugify(title) || "novo-capitulo";
    let path = `elementos-textuais/${slug}.tex`;
    for (let n = 2; project.files.some((f) => f.path === path); n++) {
      path = `elementos-textuais/${slug}-${n}.tex`;
    }
    const target = path.replace(/\.tex$/, "");
    try {
      updateFileText(project.entry, insertChapterInput(entrySource, target));
    } catch (err) {
      window.alert((err as Error).message);
      return;
    }
    setNewChapterOpen(false);
    setMetadataOpen(false);
    createFile(path, textToBytes(chapterScaffold(title, slug)));
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
      <TopBar
        projectName={workTitle || project.name}
        saveState={saveState}
        leading={
          <Tooltip content={strings.topbar.toggleRail}>
            <button
              ref={railToggleRef}
              type="button"
              data-testid="rail-toggle"
              aria-label={strings.topbar.toggleRail}
              aria-expanded={!railCollapsed}
              className="relative rounded p-1.5 text-ink-muted hover:bg-accent-soft"
              onClick={toggleRail}
            >
              {railCollapsed ? (
                <PanelLeft className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
              {railCollapsed && missingIncludes.length > 0 && (
                <span
                  className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-danger"
                  data-testid="rail-toggle-alert"
                  title={strings.rail.missingInclude}
                />
              )}
            </button>
          </Tooltip>
        }
      >
        <label className="flex items-center gap-1.5 text-ink-muted text-xs">
          <input
            type="checkbox"
            data-testid="advanced-toggle"
            checked={advanced}
            onChange={(e) => setAdvanced(e.target.checked)}
          />
          Avançado
        </label>
        {/* Idle prefetch note (D12) — yields to the compile flow's own UI. */}
        {idleWarmup.status === "running" && compileState.status === "idle" && (
          <IdleWarmupIndicator
            loaded={idleWarmup.loaded}
            total={idleWarmup.total}
            label={idleWarmup.label}
          />
        )}
        {compileState.status === "warming" && compileState.warmup && (
          <WarmupProgress {...compileState.warmup} />
        )}
        <ThemeToggle theme={ui.theme} onChange={(theme) => setUi({ theme })} />
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
        <Tooltip content={strings.topbar.exportPdf}>
          <button
            type="button"
            data-testid="export-pdf"
            aria-label={strings.topbar.exportPdf}
            disabled={!compileState.result?.pdf}
            className="rounded p-1.5 text-ink-muted hover:bg-accent-soft disabled:opacity-40"
            onClick={() => {
              const pdf = compileState.result?.pdf;
              if (pdf) download("documento.pdf", pdf, "application/pdf");
            }}
          >
            <Download className="size-4" />
          </button>
        </Tooltip>
        <div className="relative">
          <Tooltip content={strings.topbar.menuHint}>
            <button
              type="button"
              data-testid="menu-button"
              aria-label={strings.topbar.menu}
              className="rounded p-1.5 text-ink-muted hover:bg-accent-soft"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Menu className="size-4" />
            </button>
          </Tooltip>
          {menuOpen && (
            // Invisible backdrop (QA §M4): click-outside and Escape both
            // dismiss — without it the menu lingered over other popovers.
            // biome-ignore lint/a11y/noStaticElementInteractions: pointer-only dismiss layer; Escape is handled globally
            <div
              className="fixed inset-0 z-40"
              data-testid="app-menu-backdrop"
              onClick={() => setMenuOpen(false)}
              role="presentation"
            />
          )}
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
      {templateUpdateCommit && ui.dismissedTemplateCommit !== templateUpdateCommit && (
        <TemplateUpdateBanner
          onDismiss={() => setUi({ dismissedTemplateCommit: templateUpdateCommit })}
        />
      )}
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "shrink-0 overflow-hidden border-r bg-surface transition-[width] duration-200 motion-reduce:transition-none",
            railCollapsed ? "w-0 border-r-0" : "w-60",
          )}
          data-testid="project-rail"
          aria-hidden={railCollapsed}
          inert={railCollapsed || undefined}
        >
          {/* Fixed inner width: rail content keeps its layout while animating. */}
          <div className="h-full w-60 overflow-y-auto">
            <ProjectRail
              files={railFiles}
              currentPath={currentPath}
              missingIncludes={missingIncludes}
              hiddenCount={hiddenCount}
              onSelect={handleSelect}
              onReorderChapters={reorderChapters}
              onNewChapter={() => setNewChapterOpen(true)}
              onUploadFiles={(uploads) => void handleRailUpload(uploads)}
              onShowHidden={() => setAdvanced(true)}
              collapsedSections={ui.collapsedSections}
              onToggleSection={(section) =>
                setUi({
                  collapsedSections: ui.collapsedSections.includes(section)
                    ? ui.collapsedSections.filter((s) => s !== section)
                    : [...ui.collapsedSections, section],
                })
              }
              onOpenMetadata={() => setMetadataOpen(true)}
              metadataActive={metadataOpen}
              metadataPending={metadataPending}
            />
          </div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col" data-testid="editor-pane">
          {wysiwygCapable && (
            <div
              // h-9 mirrors the preview pane's tab row — the borders must meet.
              className="flex h-9 shrink-0 items-center justify-between gap-1 border-b bg-surface px-2 text-xs"
            >
              <span className="truncate text-ink-subtle" data-testid="word-count">
                {currentWords.toLocaleString("pt-BR")}{" "}
                {currentWords === 1
                  ? strings.editor.wordSingular
                  : strings.editor.wordsPlural}
                {" · "}
                {totalWords.toLocaleString("pt-BR")} {strings.editor.wordsInWork}
              </span>
              <Tooltip content={strings.topbar.viewToggleHint}>
                <button
                  type="button"
                  data-testid="view-toggle"
                  className="rounded px-2 py-0.5 text-ink-muted hover:bg-accent-soft"
                  onClick={() => setSourceView((v) => !v)}
                >
                  {showWysiwyg ? strings.editor.sourceView : strings.editor.wysiwygView}
                </button>
              </Tooltip>
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
      {metadataOpen && (
        <MetadataWizard
          fields={meta}
          onApply={applyWorkMetadata}
          onClose={() => setMetadataOpen(false)}
        />
      )}
      {newChapterOpen && (
        <NewChapterDialog
          onCreate={createChapter}
          onClose={() => setNewChapterOpen(false)}
        />
      )}
      {importState && (
        <ImportDialog
          state={importState}
          onConfirm={confirmImport}
          onClose={() => setImportState(null)}
        />
      )}
      {uiReady && !ui.welcomeSeen && !importState && (
        <WelcomeDialog
          onFill={() => {
            setUi({ welcomeSeen: true });
            setMetadataOpen(true);
          }}
          onLater={() => setUi({ welcomeSeen: true })}
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
  // PDFs render through pdf.js (QA §M5) — the old <iframe> depended on the
  // browser's PDF plugin and showed a silent blank pane without one.
  if (kind === "pdf") {
    return (
      <div className="min-h-0 flex-1" data-testid="vfs-pdf-preview">
        <PdfPane pdf={bytes} compiling={false} debugHook={false} />
      </div>
    );
  }
  return <ImagePreview path={path} bytes={bytes} />;
}

function ImagePreview({ path, bytes }: { path: string; bytes: Uint8Array }) {
  const url = useMemo(() => {
    const ext = path.split(".").pop()?.toLowerCase();
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    const copy = new Uint8Array(bytes);
    return URL.createObjectURL(new Blob([copy.buffer as ArrayBuffer], { type: mime }));
  }, [bytes, path]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="flex flex-1 items-center justify-center overflow-auto p-8">
      <img src={url} alt={path} className="max-h-full max-w-full shadow" />
    </div>
  );
}
