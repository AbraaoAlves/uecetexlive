import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { SourceEditor } from "@/features/editor/SourceEditor";
import { buildIncludeGraph } from "@/features/project/include-graph";
import { ProjectProvider, useProject } from "@/features/project/store";
import {
  bytesToText,
  isAdvancedOnly,
  type RailSection,
  railSectionOf,
} from "@/features/project/vfs";
import { strings } from "@/lib/strings";
import { ProjectRail, type RailFile } from "./ProjectRail";
import { TopBar } from "./TopBar";

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
          {currentFile ? (
            currentFile.kind === "image" || currentFile.kind === "pdf" ? (
              <BinaryPreview
                path={currentFile.path}
                bytes={currentFile.bytes}
                kind={currentFile.kind}
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
          className="flex w-[45%] shrink-0 items-center justify-center border-l bg-surface text-ink-subtle"
          data-testid="preview-pane"
        >
          {strings.preview.empty}
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
