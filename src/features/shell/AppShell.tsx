import {
  addEntry,
  buildCitationKey,
  candidateToNewEntryInput,
  type ReferenceCandidate,
  searchReferences,
} from "@papyru/bibliography";
import { SourceEditor, useEditorResources } from "@papyru/editor";
import { LogPane, PdfPane } from "@papyru/editor/preview";
import { ABNT_CITATION_PROFILE } from "@papyru/latex-mapping";
import {
  countLatexWords,
  exportProjectZip,
  importProjectZip,
  projectFromFiles,
  UECETEX2_STRUCTURE,
} from "@papyru/project-model";
import {
  Compass,
  Download,
  FileUp,
  Loader2,
  Menu,
  PanelLeft,
  PanelLeftClose,
  RotateCcw,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReferencesPanel } from "@/features/bibliography/ReferencesPanel";
import { useCompile } from "@/features/compiler/useCompile";
import { useIdleWarmup } from "@/features/compiler/useIdleWarmup";
import { ComplianceChecklist } from "@/features/compliance/ComplianceChecklist";
import {
  type ComplianceAction,
  computeComplianceChecklist,
} from "@/features/compliance/compliance-checklist";
import {
  ImportPdfDialog,
  type ImportPdfState,
} from "@/features/import-pdf/ImportPdfDialog";
import { MAX_PDF_BYTES, rejectPdf } from "@/features/import-pdf/pdf-file";
import {
  type ImportPdfOutcome,
  LowConfidenceError,
  runPdfImport,
} from "@/features/import-pdf/run-import";
import { fetchTemplateFiles } from "@/features/import-pdf/template-files";
import { MetadataWizard } from "@/features/metadata/MetadataWizard";
import { WelcomeDialog } from "@/features/metadata/WelcomeDialog";
import { WizardFullscreen } from "@/features/metadata/WizardFullscreen";
import {
  deleteProject,
  loadImportReport,
  loadLastPdf,
  saveImportReport,
} from "@/features/persistence/db";
import { useStoragePersistence } from "@/features/persistence/useStoragePersistence";
import {
  repairFolhaAprovacao,
  withHiddenSlotFillers,
} from "@/features/project/folha-aprovacao";
import { normalizeImportedProject } from "@/features/project/import-normalize";
import {
  applyImprimirToggle,
  extractImprimirToggles,
  togglesByFile,
} from "@/features/project/imprimir-toggles";
import { buildIncludeGraph, type IncludeGraph } from "@/features/project/include-graph";
import {
  applyMetadata,
  extractMetadata,
  TEMPLATE_PLACEHOLDER_TITLE,
  workTypeOf,
} from "@/features/project/metadata";
import {
  type NewSectionPlan,
  planNewSection,
  type SectionTarget,
} from "@/features/project/new-chapter";
import { rewriteInputOrder } from "@/features/project/reorder";
import {
  ABSTRACT_PATH,
  applyResumoField,
  extractResumoField,
  RESUMO_PATH,
} from "@/features/project/resumo-field";
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
import { BackupReminderBanner } from "./BackupReminderBanner";
import { CompileButton } from "./CompileButton";
import { DiagnosticsList } from "./DiagnosticsList";
import { EngineToggle } from "./EngineToggle";
import { EngineUpdateBanner } from "./EngineUpdateBanner";
import { IdleWarmupIndicator } from "./IdleWarmupIndicator";
import { ImportDialog, type ImportDialogState } from "./ImportDialog";
import { NewChapterDialog } from "./NewChapterDialog";
import { ProjectRail, type RailFile } from "./ProjectRail";
import { TemplateUpdateBanner } from "./TemplateUpdateBanner";
import { ThemeToggle } from "./ThemeToggle";
import { Tooltip } from "./Tooltip";
import { TopBar } from "./TopBar";
import { useBackupReminder } from "./useBackupReminder";
import { useEngineUpdateNotice } from "./useEngineUpdateNotice";
import { useTheme } from "./useTheme";
import { useUiSettings } from "./useUiSettings";
import { WarmupProgress } from "./WarmupProgress";

// Tiptap + KaTeX are the bulk of the JS (§11.5) — keep them out of the app
// shell chunk; the WYSIWYG surface streams in on first use.
const EditorSurface = lazy(() =>
  import("@papyru/editor").then((m) => ({
    default: m.EditorSurface,
  })),
);

/** Minimal shape of the global Tiptap handle EditorSurface exposes (window.__uecetexEditor). */
interface TiptapEditorHandle {
  commands: { insertContent: (content: Record<string, unknown>) => void };
}

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

/** Opções de import comuns ao ZIP e ao caminho PDF→projeto. */
const UECETEX2_IMPORT_OPTS = {
  structure: UECETEX2_STRUCTURE,
  templateSource: "https://github.com/thiagodnf/uecetex2",
  preferredEntry: "documento.tex",
} as const;

/** Ficha catalográfica do projeto — o guia substitui exatamente este arquivo. */
const FICHA_PATH = "elementos-pre-textuais/ficha-catalografica.pdf";

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
    updateFileBytes,
    replaceProject,
    createFile,
  } = useProject();
  const { ui, setUi, ready: uiReady } = useUiSettings();
  const advanced = ui.advancedMode;
  const railCollapsed = ui.railCollapsed;
  const railTab = ui.railTab;
  useTheme(ui.theme, uiReady);
  const { latestCommit: templateUpdateCommit } = useTemplateUpdateNotice(
    project?.templateCommit,
  );
  const { updateAvailable: engineUpdateAvailable } = useEngineUpdateNotice();
  const [engineUpdateDismissed, setEngineUpdateDismissed] = useState(false);
  useStoragePersistence();
  const { showReminder: showBackupReminder, resetReminder: resetBackupReminder } =
    useBackupReminder(ui, setUi, uiReady);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [newChapterOpen, setNewChapterOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<"pdf" | "log">("pdf");
  const [sourceView, setSourceView] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importState, setImportState] = useState<
    (ImportDialogState & { payload?: unknown }) | null
  >(null);
  const [precompiledBbl, setPrecompiledBbl] = useState<Uint8Array | undefined>();
  const [pdfImport, setPdfImport] = useState<ImportPdfState | null>(null);
  const pdfImportResult = useRef<ImportPdfOutcome | null>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const bblInputRef = useRef<HTMLInputElement>(null);
  const { state: compileState, compile, setEngine } = useCompile();
  const idleWarmup = useIdleWarmup();
  // B5: "Citation undefined" (1.5) hands the missing key here to pre-run a
  // search in the Referências tab — cleared once ReferencesPanel consumes it
  // so re-rendering doesn't keep re-triggering the same search.
  const [pendingSearchQuery, setPendingSearchQuery] = useState<string | null>(null);
  const onSearchCitation = useCallback(
    (key: string) => {
      setUi({ railTab: "references" });
      setPendingSearchQuery(key);
    },
    [setUi],
  );

  // 1.2 AC: a visitor sees a PDF without having to find "Gerar PDF" first
  // ("nunca encara tela vazia") — compile once as soon as the project is
  // ready. Skipped under automation (would race e2e specs that drive their
  // own compile), offline (would boot the app straight into an error state)
  // and Data Saver (an unrequested engine download on a metered link) — the
  // same reasons useIdleWarmup skips its prefetch.
  const autoCompiledRef = useRef(false);
  useEffect(() => {
    if (autoCompiledRef.current || !project) return;
    const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
    if (navigator.webdriver || !navigator.onLine || connection?.saveData) return;
    autoCompiledRef.current = true;
    void compile(project);
  }, [project, compile]);

  // Último PDF compilado (IndexedDB) — preview instantâneo no boot enquanto o
  // auto-compile roda (ou quando ele não roda: offline, Data Saver), marcado
  // como desatualizado pelo overlay `compiling` do PdfPane. Um resultado real
  // tem precedência e libera a cópia cacheada.
  const [cachedPdf, setCachedPdf] = useState<Uint8Array | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadLastPdf()
      .then((entry) => {
        if (!cancelled && entry) setCachedPdf(entry.pdf);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (compileState.result?.pdf) setCachedPdf(null);
  }, [compileState.result]);

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
  // Depende da *string* do arquivo de entrada (não de `project`): texSources
  // é reconstruído a cada tecla, mas conteúdo igual devolve o mesmo primitivo
  // → os memos abaixo seguram.
  const entrySource = entryPath ? (texSources[entryPath] ?? "") : "";
  // Indexado pelo arquivo que cada macro inclui — o argumento escrito no
  // documento manda, para o checkbox nunca ficar ao lado do arquivo errado.
  const imprimirToggles = useMemo(
    () => togglesByFile(extractImprimirToggles(entrySource)),
    [entrySource],
  );
  const graph = useMemo(
    () => (entryPath ? buildIncludeGraph(derivedTexSources, entryPath) : EMPTY_GRAPH),
    [derivedTexSources, entryPath],
  );
  // Same normalization as @papyru/editor's useEditorResources: \bibliography{X}
  // may omit the .bib extension.
  const bibPath = graph.bibliography
    ? `${graph.bibliography.replace(/\.bib$/, "")}.bib`
    : null;
  const bibFile = bibPath ? project?.files.find((f) => f.path === bibPath) : undefined;
  const bibText = bibFile ? bytesToText(bibFile.bytes) : null;

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
      .map((f) => {
        const toggle = imprimirToggles.get(f.path);
        return {
          path: f.path,
          dirty: dirtyPaths.has(f.path),
          locked: isAdvancedOnly(f.path) && !advanced,
          // Sem a linha no documento não há controle — nunca inventar.
          ...(toggle ? { toggle: { macro: toggle.macro, enabled: toggle.enabled } } : {}),
        };
      })
      .sort((a, b) => {
        const sa = SECTION_RANK[railSectionOf(a.path)];
        const sb = SECTION_RANK[railSectionOf(b.path)];
        if (sa !== sb) return sa - sb;
        const ga = graphRank.get(a.path) ?? Number.MAX_SAFE_INTEGER;
        const gb = graphRank.get(b.path) ?? Number.MAX_SAFE_INTEGER;
        if (ga !== gb) return ga - gb;
        return a.path.localeCompare(b.path);
      });
  }, [visibleFiles, graph, dirtyPaths, advanced, imprimirToggles]);

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
  const baseResources = useEditorResources(project, graph, addImageFile);
  // Override on top of the package's no-op defaults (its own comment points
  // here: "the consuming app owns search/dedup" — packages/editor never sees
  // CSL-JSON/DOI). searchCitations proposes a key per candidate and stashes
  // the full candidate; confirmCitation (sync, called once the user commits
  // in CitationTypeStep) resolves it into a real addEntry write — or, if the
  // key already made it into bibEntries by then, just returns it unchanged.
  const pendingCandidatesRef = useRef(new Map<string, ReferenceCandidate>());
  const resources = useMemo<typeof baseResources>(
    () => ({
      ...baseResources,
      searchCitations: async (query) => {
        const { candidates } = await searchReferences(query);
        // Merge into (never clear) pendingCandidatesRef — two searches can
        // resolve out of order, and clearing would wipe the candidates
        // backing keys already rendered from the other search.
        const used = new Set([
          ...baseResources.bibEntries.map((e) => e.key),
          ...pendingCandidatesRef.current.keys(),
        ]);
        return candidates.map((candidate) => {
          const base = buildCitationKey({
            authorSurname: candidate.authors[0]?.lastName,
            year: candidate.year ?? undefined,
            title: candidate.title,
          });
          let key = base;
          for (let n = 0; used.has(key); n++)
            key = `${base}${String.fromCharCode(97 + n)}`;
          used.add(key);
          pendingCandidatesRef.current.set(key, candidate);
          return {
            key,
            author: candidate.authors[0]?.lastName ?? "",
            title: candidate.title,
            year: candidate.year ?? "",
          };
        });
      },
      confirmCitation: (key) => {
        if (baseResources.bibEntries.some((e) => e.key === key)) return key;
        const candidate = pendingCandidatesRef.current.get(key);
        if (!candidate || bibText === null || !bibPath) {
          console.error(`confirmCitation: sem .bib disponível para adicionar "${key}"`);
          return key;
        }
        const result = addEntry(bibText, candidateToNewEntryInput(candidate));
        if (!result.ok) {
          console.error(`confirmCitation: addEntry falhou para "${key}"`, result.error);
          return key;
        }
        updateFileText(bibPath, result.value.bibText);
        return result.value.citationKey;
      },
    }),
    [baseResources, bibText, bibPath, updateFileText],
  );

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

  const resumoSource = texSources[RESUMO_PATH] ?? "";
  const abstractSource = texSources[ABSTRACT_PATH] ?? "";
  const resumoField = useMemo(
    () => extractResumoField(resumoSource, "palavraschave"),
    [resumoSource],
  );
  const abstractField = useMemo(
    () => extractResumoField(abstractSource, "keywords"),
    [abstractSource],
  );
  // Resumo/abstract live in their own files (§3.1) — merged here under
  // synthetic ids (resumobody/abstractbody) so the wizard sees one flat
  // fields map, same as every documento.tex macro.
  const meta = useMemo(() => {
    const merged = withHiddenSlotFillers(extractMetadata(entrySource));
    if (resumoField) {
      merged.set("resumobody", {
        macro: "resumobody",
        value: resumoField.body,
        start: resumoField.bodyStart,
        end: resumoField.bodyEnd,
      });
      merged.set("palavraschave", {
        macro: "palavraschave",
        value: resumoField.keywords,
        start: resumoField.keywordsStart,
        end: resumoField.keywordsEnd,
      });
    }
    if (abstractField) {
      merged.set("abstractbody", {
        macro: "abstractbody",
        value: abstractField.body,
        start: abstractField.bodyStart,
        end: abstractField.bodyEnd,
      });
      merged.set("keywords", {
        macro: "keywords",
        value: abstractField.keywords,
        start: abstractField.keywordsStart,
        end: abstractField.keywordsEnd,
      });
    }
    return merged;
  }, [entrySource, resumoField, abstractField]);
  const workTitle = meta.get("titulo")?.value.trim() ?? "";
  const metadataPending = workTitle === "" || workTitle === TEMPLATE_PLACEHOLDER_TITLE;

  // 3.2 — not a per-keystroke hot path (opened deliberately from the rail),
  // so it can key on the debounced source map like the include graph does.
  // Relatório da última importação de PDF deste projeto — persistido para a
  // lista de pendências não sumir no recarregamento.
  const [importPendencies, setImportPendencies] = useState<number | undefined>();
  const projectId = project?.id ?? null;
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    loadImportReport(projectId)
      .then((report: unknown) => {
        const pendencias = (report as { pendencias?: unknown[] } | undefined)?.pendencias;
        if (!cancelled) setImportPendencies(pendencias?.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const complianceChecks = useMemo(
    () =>
      computeComplianceChecklist({
        meta,
        workType: workTypeOf(meta),
        bibText,
        texSources: derivedTexSources,
        citeCommands: ABNT_CITATION_PROFILE.citeCommands,
        importPendencies,
      }),
    [meta, bibText, derivedTexSources, importPendencies],
  );
  const checklistWarnCount = complianceChecks.filter((c) => c.status === "warn").length;

  const handleComplianceAction = useCallback(
    (action: ComplianceAction) => {
      setChecklistOpen(false);
      if (action.kind === "openMetadata") {
        setMetadataOpen(true);
      } else if (action.kind === "openReferences") {
        setUi({ railTab: "references" });
      } else if (action.kind === "openFile") {
        openFile(action.path);
      }
    },
    [setUi, openFile],
  );

  const applyWorkMetadata = useCallback(
    (updates: Map<string, string>) => {
      if (!project) return;
      const docUpdates = new Map<string, string>();
      const resumoUpdates: { body?: string; keywords?: string } = {};
      const abstractUpdates: { body?: string; keywords?: string } = {};
      for (const [key, value] of updates) {
        if (key === "resumobody") resumoUpdates.body = value;
        else if (key === "abstractbody") abstractUpdates.body = value;
        else if (key === "palavraschave") resumoUpdates.keywords = value;
        else if (key === "keywords") abstractUpdates.keywords = value;
        else docUpdates.set(key, value);
      }
      if (docUpdates.size > 0) {
        // Reparar depois de gravar: esvaziar o centro de um membro (ou trocar
        // o tipo de trabalho para TCC) recria a folha de aprovação quebrada.
        const next = applyMetadata(entrySource, docUpdates);
        updateFileText(project.entry, repairFolhaAprovacao(next) ?? next);
      }
      if (
        resumoField &&
        (resumoUpdates.body !== undefined || resumoUpdates.keywords !== undefined)
      ) {
        updateFileText(
          RESUMO_PATH,
          applyResumoField(resumoSource, resumoField, resumoUpdates),
        );
      }
      if (
        abstractField &&
        (abstractUpdates.body !== undefined || abstractUpdates.keywords !== undefined)
      ) {
        updateFileText(
          ABSTRACT_PATH,
          applyResumoField(abstractSource, abstractField, abstractUpdates),
        );
      }
    },
    [
      project,
      entrySource,
      resumoField,
      resumoSource,
      abstractField,
      abstractSource,
      updateFileText,
    ],
  );

  const toggleImprimir = useCallback(
    (macro: string, enabled: boolean) => {
      if (!project) return;
      const next = applyImprimirToggle(entrySource, macro, enabled);
      if (next !== entrySource) updateFileText(project.entry, next);
    },
    [project, entrySource, updateFileText],
  );

  const runCompile = useCallback(() => {
    if (!project) return;
    setPreviewTab("pdf");
    void compile(project, { precompiledBbl });
  }, [project, compile, precompiledBbl]);

  /** Estado das linhas opcionais, indexado por macro (o guia usa a macro). */
  const guideToggles = useMemo(() => extractImprimirToggles(entrySource), [entrySource]);

  const fichaFile = project?.files.find((f) => f.path === FICHA_PATH);
  const fichaSize = fichaFile?.bytes.byteLength ?? null;
  const replaceFicha = useCallback(
    (bytes: Uint8Array) => {
      if (!project) return;
      if (fichaFile) updateFileBytes(FICHA_PATH, bytes);
      else createFile(FICHA_PATH, bytes);
    },
    [project, fichaFile, updateFileBytes, createFile],
  );

  const wysiwygCapable =
    currentFile !== null &&
    currentFile.kind === "tex" &&
    isWysiwygEligible(currentFile.path);
  const showWysiwyg = wysiwygCapable && !sourceView;
  // B5(b): "Inserir citação no texto" from the Referências row. Only safe
  // when the WYSIWYG surface for a .tex file is actually mounted — otherwise
  // window.__uecetexEditor is stale (a different/no-longer-open file) and
  // inserting into it would silently corrupt the wrong document.
  const insertCitationAtCursor = showWysiwyg
    ? (key: string) => {
        const editor = (window as unknown as { __uecetexEditor?: TiptapEditorHandle })
          .__uecetexEditor;
        editor?.commands.insertContent({
          type: "citation",
          attrs: { cmd: ABNT_CITATION_PROFILE.citeCommands[0], keys: [key], opt: null },
        });
      }
    : undefined;

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

  const exportBackupZip = () => {
    if (!project) return;
    download(`${project.name}.zip`, exportProjectZip(project), "application/zip");
    resetBackupReminder();
  };

  const handleZipFile = async (file: File) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const imported = normalizeImportedProject(
        await importProjectZip(bytes, "uecetex2", UECETEX2_IMPORT_OPTS),
      );
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

  // O worker consome os bytes (transferíveis), então cada tentativa precisa da
  // sua própria cópia — inclusive o "tentar mesmo assim".
  const pdfBytesRef = useRef<Uint8Array | null>(null);

  const runPdfPipeline = async (bytes: Uint8Array, force: boolean) => {
    setPdfImport({ kind: "running", stage: "lendo", pct: 0 });
    try {
      const template = await fetchTemplateFiles();
      const outcome = await runPdfImport(
        new Uint8Array(bytes),
        template,
        (stage, pct) => setPdfImport({ kind: "running", stage, pct }),
        force,
      );
      pdfImportResult.current = outcome;
      setPdfImport({
        kind: "report",
        report: outcome.report,
        fileCount: outcome.files.size,
      });
    } catch (err) {
      pdfImportResult.current = null;
      if (err instanceof LowConfidenceError) setPdfImport({ kind: "low-confidence" });
      else setPdfImport({ kind: "error", message: (err as Error).message });
    }
  };

  const handlePdfFile = async (file: File) => {
    // O tamanho é conferido ANTES de ler: um arquivo enorme escolhido por
    // engano não precisa virar memória para ser recusado.
    if (file.size > MAX_PDF_BYTES) {
      setPdfImport({ kind: "error", message: strings.importPdf.errorSize });
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const problem = rejectPdf(file.name, bytes);
    if (problem) {
      setPdfImport({ kind: "error", message: problem });
      return;
    }
    pdfBytesRef.current = bytes;
    await runPdfPipeline(bytes, false);
  };

  /** Cria o projeto pelo MESMO caminho do import de zip (normalizações inclusas). */
  const confirmPdfImport = async () => {
    const outcome = pdfImportResult.current;
    if (!outcome) return;
    const imported = normalizeImportedProject(
      projectFromFiles(outcome.files, "uecetex2", UECETEX2_IMPORT_OPTS),
    );
    replaceProject(imported);
    openFile("documento.tex");
    setPdfImport(null);
    pdfImportResult.current = null;
    await saveImportReport(imported.id, outcome.report).catch((err) => {
      // O projeto já está criado; perder o relatório não desfaz isso, mas
      // engolir o erro esconderia por que a lista de pendências não apareceu.
      console.error("não foi possível guardar o relatório da importação", err);
    });
    setImportPendencies(outcome.report.pendencias.length);
    setGuideOpen(true);
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

  const createChapter = (title: string, target: SectionTarget = "chapter") => {
    if (!project) return;
    let plan: NewSectionPlan;
    try {
      plan = planNewSection(
        entrySource,
        title,
        target,
        new Set(project.files.map((f) => f.path)),
      );
    } catch (err) {
      window.alert((err as Error).message);
      return;
    }
    // Apêndice e anexo só saem no PDF com a seção ligada — criar um arquivo
    // que não aparece seria pior do que não criar.
    const source = plan.enableMacro
      ? applyImprimirToggle(plan.source, plan.enableMacro, true)
      : plan.source;
    updateFileText(project.entry, source);
    setNewChapterOpen(false);
    setMetadataOpen(false);
    createFile(plan.path, textToBytes(plan.content));
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
        {strings.app.loading}
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
        {/* Idle prefetch note (D12) — yields to the compile flow's own topbar
            UI while a compile is active, but must come back afterwards: with
            the boot auto-compile the status never returns to "idle". */}
        {idleWarmup.status === "running" &&
          compileState.status !== "warming" &&
          compileState.status !== "compiling" && (
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
          onCompile={runCompile}
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
              if (pdf) {
                download("documento.pdf", pdf, "application/pdf");
              }
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
                  exportBackupZip();
                }}
              >
                <Download className="size-3.5" /> {strings.topbar.exportZip}
              </MenuItem>
              <MenuItem
                testid="menu-import-pdf"
                onClick={() => {
                  setMenuOpen(false);
                  pdfInputRef.current?.click();
                }}
              >
                <FileUp className="size-3.5" /> {strings.importPdf.menuEntry}
              </MenuItem>
              <MenuItem
                testid="menu-open-guide"
                onClick={() => {
                  setMenuOpen(false);
                  setGuideOpen(true);
                }}
              >
                <Compass className="size-3.5" /> {strings.topbar.openGuide}
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
          ref={pdfInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          data-testid="pdf-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handlePdfFile(file);
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
      {engineUpdateAvailable && !engineUpdateDismissed && (
        <EngineUpdateBanner
          onReload={() => window.location.reload()}
          onDismiss={() => setEngineUpdateDismissed(true)}
        />
      )}
      {project && showBackupReminder && (
        <BackupReminderBanner
          onExport={exportBackupZip}
          onDismiss={resetBackupReminder}
        />
      )}
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "shrink-0 overflow-hidden border-r bg-surface transition-[width] duration-200 motion-reduce:transition-none",
            railCollapsed ? "w-0 border-r-0" : railTab === "references" ? "w-96" : "w-60",
          )}
          data-testid="project-rail"
          aria-hidden={railCollapsed}
          inert={railCollapsed || undefined}
        >
          {/* Inner width mirrors the <aside> above: rail content keeps its
              layout while animating, but must widen too (ADR-07) or the
              Referências form gets clipped at the old 240px. */}
          <div
            className={cn(
              "flex h-full flex-col overflow-hidden",
              railTab === "references" ? "w-96" : "w-60",
            )}
          >
            <div className="flex shrink-0 border-b text-xs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={railTab === "files"}
                data-testid="rail-tab-files"
                onClick={() => setUi({ railTab: "files" })}
                className={cn(
                  "flex-1 px-3 py-2",
                  railTab === "files"
                    ? "border-accent border-b-2 font-medium text-foreground"
                    : "text-ink-muted hover:text-foreground",
                )}
              >
                {strings.rail.filesTab}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={railTab === "references"}
                data-testid="rail-tab-references"
                onClick={() => setUi({ railTab: "references" })}
                className={cn(
                  "flex-1 px-3 py-2",
                  railTab === "references"
                    ? "border-accent border-b-2 font-medium text-foreground"
                    : "text-ink-muted hover:text-foreground",
                )}
              >
                {strings.rail.referencesTab}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {railTab === "files" ? (
                <ProjectRail
                  files={railFiles}
                  onToggleImprimir={toggleImprimir}
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
                  onOpenChecklist={() => setChecklistOpen(true)}
                  checklistActive={checklistOpen}
                  checklistWarnCount={checklistWarnCount}
                />
              ) : (
                <ReferencesPanel
                  bibText={bibText}
                  onWriteBib={
                    bibPath ? (next) => updateFileText(bibPath, next) : undefined
                  }
                  initialSearchQuery={pendingSearchQuery}
                  onSearchQueryConsumed={() => setPendingSearchQuery(null)}
                  onInsertCitation={insertCitationAtCursor}
                  texSources={texSources}
                />
              )}
            </div>
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
          className="relative flex w-[45%] shrink-0 flex-col border-l bg-surface"
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
                pdf={compileState.result?.pdf ?? cachedPdf}
                compiling={
                  compileState.status === "compiling" || compileState.status === "warming"
                }
              />
            ) : (
              <div className="flex h-full flex-col">
                <DiagnosticsList
                  diagnostics={compileState.result?.diagnostics ?? []}
                  ctx={{ bibPath, openFile, onSearchCitation }}
                />
                <div className="min-h-0 flex-1">
                  <LogPane
                    log={compileState.result?.log ?? compileState.error ?? ""}
                    diagnostics={[]}
                    draftMode={
                      compileState.engine === "swiftlatex-draft" &&
                      compileState.result !== null
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
      {metadataOpen && (
        <MetadataWizard
          fields={meta}
          onApply={applyWorkMetadata}
          onClose={() => setMetadataOpen(false)}
          persisted={saveState === "saved"}
        />
      )}
      {checklistOpen && (
        <ComplianceChecklist
          checks={complianceChecks}
          onAction={handleComplianceAction}
          onClose={() => setChecklistOpen(false)}
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
      {pdfImport && (
        <ImportPdfDialog
          state={pdfImport}
          onConfirm={() => void confirmPdfImport()}
          onForce={() => {
            const bytes = pdfBytesRef.current;
            if (bytes) void runPdfPipeline(bytes, true);
          }}
          onClose={() => {
            setPdfImport(null);
            pdfImportResult.current = null;
          }}
        />
      )}
      {guideOpen && (
        <WizardFullscreen
          fields={meta}
          onApply={applyWorkMetadata}
          onClose={() => setGuideOpen(false)}
          toggles={guideToggles}
          onToggle={toggleImprimir}
          onFicha={replaceFicha}
          fichaSize={fichaSize}
          onCompile={() => {
            setGuideOpen(false);
            runCompile();
          }}
          persisted={saveState === "saved"}
          compiling={
            compileState.status === "compiling" || compileState.status === "warming"
          }
        />
      )}
      {uiReady && !ui.welcomeSeen && !importState && (
        <WelcomeDialog
          onFill={() => {
            setUi({ welcomeSeen: true });
            setGuideOpen(true);
          }}
          onLater={() => setUi({ welcomeSeen: true })}
          onImportPdf={() => {
            setUi({ welcomeSeen: true });
            pdfInputRef.current?.click();
          }}
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
