import {
  BookMarked,
  ChevronDown,
  ClipboardList,
  FileWarning,
  ListChecks,
  Lock,
  Plus,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { type RailSection, railSectionOf } from "@/features/project/vfs";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { Tooltip } from "./Tooltip";

export interface RailFile {
  path: string;
  dirty: boolean;
  locked: boolean;
  /** Página opcional: o checkbox inclui ou tira o arquivo do PDF (M2). */
  toggle?: { macro: string; enabled: boolean };
}

export interface ProjectRailProps {
  /** Pre-ordered (chapter order = \input sequence, computed by the shell). */
  files: RailFile[];
  currentPath: string | null;
  /** Unresolved \input targets (red entries, §5.3). */
  missingIncludes: string[];
  /** Files filtered out by simple mode (0 when "Avançado" is on). */
  hiddenCount?: number;
  onSelect: (path: string) => void;
  /** Chapter drag-reorder (§4.6): drop `from` before `to`. */
  onReorderChapters?: (from: string, to: string) => void;
  /** "+" in the chapters header — scaffold file + \input (QA Fase 1). */
  onNewChapter?: () => void;
  /** Upload in the figures header — images, PDFs and code files (QA §A4). */
  onUploadFiles?: (files: File[]) => void;
  /** "mostrar" next to the hidden-files count enables advanced mode (QA §B2). */
  onShowHidden?: () => void;
  /** Folded section headers; controlled (persisted in UiSettings) when given. */
  collapsedSections?: readonly string[];
  onToggleSection?: (section: RailSection) => void;
  /** Opens the "Dados do Trabalho" wizard (F2). */
  onOpenMetadata?: () => void;
  metadataActive?: boolean;
  /** Title still the template placeholder — nudge the student. */
  metadataPending?: boolean;
  /** Opens the "Meu trabalho está certo?" checklist (3.2). */
  onOpenChecklist?: () => void;
  checklistActive?: boolean;
  /** Number of checklist items currently failing — 0 hides the badge. */
  checklistWarnCount?: number;
  /** Inclui ou tira do PDF a página opcional do arquivo (M2). */
  onToggleImprimir?: (macro: string, enabled: boolean) => void;
}

const SECTION_ORDER: RailSection[] = [
  "root",
  "preTextual",
  "chapters",
  "postTextual",
  "library",
  "figures",
];

const SECTION_LABEL: Record<RailSection, string> = {
  root: strings.app.name,
  preTextual: strings.rail.preTextual,
  chapters: strings.rail.chapters,
  postTextual: strings.rail.postTextual,
  library: strings.rail.library,
  figures: strings.rail.figures,
};

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

export function ProjectRail({
  files,
  currentPath,
  missingIncludes,
  hiddenCount = 0,
  onSelect,
  onReorderChapters,
  onNewChapter,
  onUploadFiles,
  onShowHidden,
  collapsedSections,
  onToggleSection,
  onOpenMetadata,
  metadataActive = false,
  metadataPending = false,
  onOpenChecklist,
  checklistActive = false,
  checklistWarnCount = 0,
  onToggleImprimir,
}: ProjectRailProps) {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  // Uncontrolled fallback (stories/tests without the persisted UiSettings).
  const [localCollapsed, setLocalCollapsed] = useState<readonly string[]>([]);
  const collapsed = collapsedSections ?? localCollapsed;
  const toggleSection = (section: RailSection) => {
    if (onToggleSection) onToggleSection(section);
    else
      setLocalCollapsed((prev) =>
        prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section],
      );
  };
  const bySection = new Map<RailSection, RailFile[]>();
  for (const file of files) {
    const section = railSectionOf(file.path);
    const list = bySection.get(section) ?? [];
    list.push(file);
    bySection.set(section, list);
  }

  return (
    <nav aria-label="Arquivos do projeto" className="py-2 text-sm">
      {onUploadFiles && (
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.pdf,.cpp,.c,.h,.java,.py,.js,.ts"
          className="hidden"
          data-testid="rail-upload-input"
          onChange={(e) => {
            const list = e.target.files;
            if (list?.length) onUploadFiles(Array.from(list));
            e.target.value = "";
          }}
        />
      )}
      {onOpenMetadata && (
        <button
          type="button"
          data-testid="rail-metadata"
          onClick={onOpenMetadata}
          className={cn(
            "mb-1 flex w-full items-center gap-2 px-3 py-1.5 text-left font-medium hover:bg-accent-soft/60",
            metadataActive && "bg-accent-soft text-accent-strong",
          )}
        >
          <ClipboardList className="size-3.5 shrink-0" />
          <span className="truncate">{strings.metadata.railEntry}</span>
          {metadataPending && (
            <Tooltip content={strings.metadata.pendingHint}>
              <span
                className="ml-auto size-1.5 shrink-0 rounded-full bg-warning"
                data-testid="metadata-pending-dot"
              />
            </Tooltip>
          )}
        </button>
      )}
      {onOpenChecklist && (
        <button
          type="button"
          data-testid="rail-checklist"
          onClick={onOpenChecklist}
          className={cn(
            "mb-1 flex w-full items-center gap-2 px-3 py-1.5 text-left font-medium hover:bg-accent-soft/60",
            checklistActive && "bg-accent-soft text-accent-strong",
          )}
        >
          <ListChecks className="size-3.5 shrink-0" />
          <span className="truncate">{strings.compliance.railEntry}</span>
          {checklistWarnCount > 0 && (
            <Tooltip content={strings.compliance.pendingHint}>
              <span
                className="ml-auto rounded-full bg-warning/20 px-1.5 py-0.5 text-[10px] text-warning"
                data-testid="checklist-pending-count"
              >
                {checklistWarnCount}
              </span>
            </Tooltip>
          )}
        </button>
      )}
      {SECTION_ORDER.map((section) => {
        const sectionFiles = bySection.get(section);
        const showMissing = section === "chapters" && missingIncludes.length > 0;
        if (!sectionFiles?.length && !showMissing) return null;
        const isCollapsed = section !== "root" && collapsed.includes(section);
        return (
          <div key={section} className="mb-1" data-testid={`rail-section-${section}`}>
            {section !== "root" && (
              <div className="flex items-center justify-between px-3 pt-2 pb-1 font-medium text-[11px] text-ink-subtle uppercase tracking-wider">
                <button
                  type="button"
                  data-testid={`rail-section-toggle-${section}`}
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleSection(section)}
                  className="flex min-w-0 items-center gap-1 uppercase tracking-wider hover:text-ink"
                >
                  <ChevronDown
                    className={cn(
                      "size-3 shrink-0 transition-transform",
                      isCollapsed && "-rotate-90",
                    )}
                  />
                  <span className="truncate">{SECTION_LABEL[section]}</span>
                </button>
                {section === "chapters" && onNewChapter && (
                  <Tooltip content={strings.rail.newChapter}>
                    <button
                      type="button"
                      data-testid="new-chapter"
                      aria-label={strings.rail.newChapter}
                      onClick={onNewChapter}
                      className="rounded p-0.5 hover:bg-accent-soft hover:text-accent-strong"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </Tooltip>
                )}
                {section === "figures" && onUploadFiles && (
                  <Tooltip content={strings.rail.uploadFile}>
                    <button
                      type="button"
                      data-testid="rail-upload"
                      aria-label={strings.rail.uploadFile}
                      onClick={() => uploadInputRef.current?.click()}
                      className="rounded p-0.5 hover:bg-accent-soft hover:text-accent-strong"
                    >
                      <Upload className="size-3.5" />
                    </button>
                  </Tooltip>
                )}
              </div>
            )}
            {!isCollapsed && (
              <ul>
                {sectionFiles?.map((file) => (
                  <li key={file.path} className="flex items-center">
                    {file.toggle && (
                      <Tooltip
                        content={
                          file.toggle.enabled
                            ? strings.rail.toggleInclude
                            : strings.rail.toggleExcluded
                        }
                      >
                        <input
                          type="checkbox"
                          data-testid={`rail-toggle-${file.toggle.macro}`}
                          aria-label={`${baseName(file.path)} — ${
                            file.toggle.enabled
                              ? strings.rail.toggleInclude
                              : strings.rail.toggleExcluded
                          }`}
                          checked={file.toggle.enabled}
                          disabled={!onToggleImprimir}
                          onChange={(e) =>
                            onToggleImprimir?.(
                              file.toggle?.macro ?? "",
                              e.currentTarget.checked,
                            )
                          }
                          className="ml-3 size-3.5 shrink-0 accent-accent"
                        />
                      </Tooltip>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelect(file.path)}
                      data-testid={`rail-file-${file.path}`}
                      draggable={section === "chapters" && !!onReorderChapters}
                      onDragStart={(e) =>
                        e.dataTransfer.setData("text/uecetex-chapter", file.path)
                      }
                      onDragOver={(e) => {
                        if (section === "chapters") e.preventDefault();
                      }}
                      onDrop={(e) => {
                        const from = e.dataTransfer.getData("text/uecetex-chapter");
                        if (from && from !== file.path) {
                          e.preventDefault();
                          onReorderChapters?.(from, file.path);
                        }
                      }}
                      className={cn(
                        "flex w-full min-w-0 items-center gap-2 px-3 py-1 text-left hover:bg-accent-soft/60",
                        file.toggle && "pl-2",
                        currentPath === file.path &&
                          "bg-accent-soft font-medium text-accent-strong",
                      )}
                    >
                      <span
                        className={cn(
                          "truncate",
                          // Desligado continua editável — só não entra no PDF.
                          file.toggle?.enabled === false && "opacity-60",
                        )}
                      >
                        {baseName(file.path)}
                      </span>
                      {file.path.endsWith(".bib") && (
                        <Tooltip content={strings.rail.bibFileHint}>
                          <BookMarked
                            className="size-3 shrink-0 text-ink-subtle"
                            aria-label={strings.rail.bibFileHint}
                          />
                        </Tooltip>
                      )}
                      {file.dirty && (
                        <Tooltip content={strings.rail.unsavedChanges}>
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-warning"
                            data-testid="dirty-dot"
                          />
                        </Tooltip>
                      )}
                      {file.locked && (
                        <Lock
                          className="ml-auto size-3 shrink-0 text-ink-subtle"
                          aria-label="Somente leitura (avançado)"
                        />
                      )}
                    </button>
                  </li>
                ))}
                {showMissing &&
                  missingIncludes.map((path) => (
                    <li key={path}>
                      <Tooltip content={strings.rail.missingInclude}>
                        <button
                          type="button"
                          onClick={() => onSelect(path)}
                          className="flex w-full items-center gap-2 px-3 py-1 text-left text-danger hover:bg-danger/10"
                        >
                          <FileWarning className="size-3 shrink-0" />
                          <span className="truncate">{baseName(path)}</span>
                        </button>
                      </Tooltip>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <Tooltip content={strings.rail.hiddenFilesHint}>
          <div
            className="px-3 pt-3 pb-1 text-[11px] text-ink-subtle"
            data-testid="rail-hidden-count"
          >
            {hiddenCount}{" "}
            {hiddenCount === 1
              ? strings.rail.hiddenFileSingular
              : strings.rail.hiddenFilesPlural}
            {onShowHidden && (
              <>
                {" — "}
                <button
                  type="button"
                  data-testid="rail-show-hidden"
                  className="text-accent hover:underline"
                  onClick={onShowHidden}
                >
                  {strings.rail.showHiddenFiles}
                </button>
              </>
            )}
          </div>
        </Tooltip>
      )}
    </nav>
  );
}
