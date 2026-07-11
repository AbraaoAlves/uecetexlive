import {
  type BibliographyEntry,
  type Chunk,
  ENTRY_TYPE_LABELS_PT,
  type EntryTypeTag,
  entryTypeName,
  isKnownEntryType,
  isParseFailure,
  parseBibFile,
} from "@papyru/bibliography";
import { useMemo, useState } from "react";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { EntryTypeIcon } from "./entry-type-icon";
import { formatAuthorsList } from "./format-authors";

export interface ReferencesPanelProps {
  /** null = no .bib discovered yet in the project (see include-graph). */
  bibText: string | null;
}

type SortMode = "file" | "author" | "year";
type FailureChunk = Extract<Chunk, { kind: "entry" }>;

interface ListRow {
  key: string;
  entry: BibliographyEntry;
  authorsLabel: string | null;
  titleLabel: string;
  yearLabel: string;
}

function entryTypeLabelPt(type: EntryTypeTag): string {
  return isKnownEntryType(type) ? ENTRY_TYPE_LABELS_PT[type] : entryTypeName(type);
}

const SORT_OPTIONS: { mode: SortMode; label: keyof typeof strings.references }[] = [
  { mode: "file", label: "sortFile" },
  { mode: "author", label: "sortAuthor" },
  { mode: "year", label: "sortYear" },
];

export function ReferencesPanel({ bibText }: ReferencesPanelProps) {
  const [sort, setSort] = useState<SortMode>("file");
  const [showRaw, setShowRaw] = useState(false);

  const { rows, failures } = useMemo(() => {
    if (bibText === null)
      return { rows: [] as ListRow[], failures: [] as FailureChunk[] };
    const file = parseBibFile(bibText);
    const rows: ListRow[] = [];
    const failures: FailureChunk[] = [];
    for (const chunk of file.chunks) {
      if (chunk.kind !== "entry") continue;
      if (isParseFailure(chunk.parsed)) {
        failures.push(chunk);
        continue;
      }
      const entry = chunk.parsed;
      rows.push({
        key: entry.citationKey,
        entry,
        authorsLabel: formatAuthorsList(entry.fields.get("author")?.value),
        titleLabel: entry.fields.get("title")?.value ?? strings.references.untitled,
        yearLabel: entry.fields.get("year")?.value ?? strings.references.unknownYear,
      });
    }
    return { rows, failures };
  }, [bibText]);

  const sortedRows = useMemo(() => {
    if (sort === "file") return rows;
    const copy = [...rows];
    copy.sort((a, b) =>
      sort === "author"
        ? (a.authorsLabel ?? "").localeCompare(b.authorsLabel ?? "")
        : a.yearLabel.localeCompare(b.yearLabel),
    );
    return copy;
  }, [rows, sort]);

  if (bibText === null) {
    return (
      <div className="p-4 text-ink-muted text-sm" data-testid="references-empty">
        {strings.references.noBibFile}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="references-panel">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs">
        <div
          className="flex items-center gap-1"
          role="radiogroup"
          aria-label="Ordenar por"
        >
          {SORT_OPTIONS.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={sort === mode}
              data-testid={`references-sort-${mode}`}
              onClick={() => setSort(mode)}
              className={cn(
                "rounded px-2 py-1",
                sort === mode
                  ? "bg-accent-soft font-medium"
                  : "text-ink-muted hover:text-foreground",
              )}
            >
              {strings.references[label]}
            </button>
          ))}
        </div>
        <button
          type="button"
          data-testid="references-toggle-code"
          className="text-accent underline hover:no-underline"
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? strings.references.viewList : strings.references.viewCode}
        </button>
      </div>

      {showRaw ? (
        <pre
          className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-[11px] leading-relaxed text-ink-muted"
          data-testid="references-raw"
        >
          {bibText}
        </pre>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 && failures.length === 0 && (
            <div className="p-4 text-ink-muted text-sm">{strings.references.empty}</div>
          )}
          <ul data-testid="references-list">
            {sortedRows.map((row) => (
              <li
                key={row.key}
                className="border-b px-3 py-2 text-sm"
                data-testid={`reference-${row.key}`}
              >
                <div className="flex items-center gap-1.5 text-ink-muted text-xs">
                  <EntryTypeIcon type={row.entry.entryType} />
                  <span>{entryTypeLabelPt(row.entry.entryType)}</span>
                </div>
                <div className="font-medium">{row.titleLabel}</div>
                <div className="text-ink-muted text-xs">
                  <span>{row.authorsLabel ?? strings.references.unknownAuthor}</span> ·{" "}
                  <span>{row.yearLabel}</span>
                </div>
              </li>
            ))}
          </ul>
          {failures.map((chunk, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: failures have no reliable key; replaced wholesale per parse
            <FailureCard key={i} chunk={chunk} />
          ))}
        </div>
      )}
    </div>
  );
}

function FailureCard({ chunk }: { chunk: FailureChunk }) {
  return (
    <details
      className="border-b px-3 py-2 text-danger text-sm"
      data-testid="reference-parse-failure"
    >
      <summary className="cursor-pointer font-medium">
        {strings.references.unreadableCard}
      </summary>
      <p className="mt-1 text-ink-muted text-xs">{strings.references.unreadableHint}</p>
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px] text-ink-muted">
        {chunk.raw}
      </pre>
    </details>
  );
}
