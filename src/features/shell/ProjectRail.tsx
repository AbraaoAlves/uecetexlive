import { ClipboardList, FileWarning, Lock } from "lucide-react";
import { type RailSection, railSectionOf } from "@/features/project/vfs";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";

export interface RailFile {
  path: string;
  dirty: boolean;
  locked: boolean;
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
  /** Opens the "Dados do Trabalho" wizard (F2). */
  onOpenMetadata?: () => void;
  metadataActive?: boolean;
  /** Title still the template placeholder — nudge the student. */
  metadataPending?: boolean;
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
  onOpenMetadata,
  metadataActive = false,
  metadataPending = false,
}: ProjectRailProps) {
  const bySection = new Map<RailSection, RailFile[]>();
  for (const file of files) {
    const section = railSectionOf(file.path);
    const list = bySection.get(section) ?? [];
    list.push(file);
    bySection.set(section, list);
  }

  return (
    <nav aria-label="Arquivos do projeto" className="py-2 text-sm">
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
            <span
              className="ml-auto size-1.5 shrink-0 rounded-full bg-warning"
              data-testid="metadata-pending-dot"
              title={strings.metadata.pendingHint}
            />
          )}
        </button>
      )}
      {SECTION_ORDER.map((section) => {
        const sectionFiles = bySection.get(section);
        const showMissing = section === "chapters" && missingIncludes.length > 0;
        if (!sectionFiles?.length && !showMissing) return null;
        return (
          <div key={section} className="mb-1" data-testid={`rail-section-${section}`}>
            {section !== "root" && (
              <div className="px-3 pt-2 pb-1 font-medium text-[11px] text-ink-subtle uppercase tracking-wider">
                {SECTION_LABEL[section]}
              </div>
            )}
            <ul>
              {sectionFiles?.map((file) => (
                <li key={file.path}>
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
                      "flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-accent-soft/60",
                      currentPath === file.path &&
                        "bg-accent-soft font-medium text-accent-strong",
                    )}
                  >
                    <span className="truncate">{baseName(file.path)}</span>
                    {file.dirty && (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-warning"
                        data-testid="dirty-dot"
                        title="Alterações não salvas"
                      />
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
                    <button
                      type="button"
                      onClick={() => onSelect(path)}
                      className="flex w-full items-center gap-2 px-3 py-1 text-left text-danger hover:bg-danger/10"
                      title={strings.rail.missingInclude}
                    >
                      <FileWarning className="size-3 shrink-0" />
                      <span className="truncate">{baseName(path)}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <div
          className="px-3 pt-3 pb-1 text-[11px] text-ink-subtle"
          data-testid="rail-hidden-count"
          title={strings.rail.hiddenFilesHint}
        >
          {hiddenCount}{" "}
          {hiddenCount === 1
            ? strings.rail.hiddenFileSingular
            : strings.rail.hiddenFilesPlural}
        </div>
      )}
    </nav>
  );
}
