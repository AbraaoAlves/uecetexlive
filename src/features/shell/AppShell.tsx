import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCompile } from "@/features/compiler/useCompile";
import { EditorSurface } from "@/features/editor/EditorSurface";
import { SourceEditor } from "@/features/editor/SourceEditor";
import { useEditorResources } from "@/features/editor/useEditorResources";
import { LogPane } from "@/features/preview/LogPane";
import { PdfPane } from "@/features/preview/PdfPane";
import { buildIncludeGraph } from "@/features/project/include-graph";
import { ProjectProvider, useProject } from "@/features/project/store";
import {
  bytesToText,
  isAdvancedOnly,
  isWysiwygEligible,
  type RailSection,
  railSectionOf,
} from "@/features/project/vfs";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { CompileButton } from "./CompileButton";
import { EngineToggle } from "./EngineToggle";
import { ProjectRail, type RailFile } from "./ProjectRail";
import { TopBar } from "./TopBar";
import { WarmupProgress } from "./WarmupProgress";

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
  } = useProject();
  const [advanced, setAdvanced] = useState(false);
  const [previewTab, setPreviewTab] = useState<"pdf" | "log">("pdf");
  const [sourceView, setSourceView] = useState(false);
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
            void compile(project);
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
            onSelect={openFile}
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
              <EditorSurface
                path={currentFile.path}
                source={bytesToText(currentFile.bytes)}
                resources={resources}
                onChange={(text) => updateFileText(currentFile.path, text)}
              />
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
    </div>
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
