import {
  addEntry,
  type BibliographyEntry,
  type Chunk,
  candidateToNewEntryInput,
  ENTRY_TYPE_LABELS_PT,
  type EntryTypeTag,
  entryTypeName,
  isKnownEntryType,
  isParseFailure,
  type NewEntryInput,
  parseBibFile,
  type ReferenceCandidate,
} from "@papyru/bibliography";
import { ABNT_CITATION_PROFILE } from "@papyru/latex-mapping";
import { useMemo, useState } from "react";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { AddReferenceDialog } from "./AddReferenceDialog";
import { EntryTypeIcon } from "./entry-type-icon";
import { formatAuthorsList } from "./format-authors";
import { ReferenceSearch } from "./ReferenceSearch";

export interface ReferencesPanelProps {
  /** null = no .bib discovered yet in the project (see include-graph). */
  bibText: string | null;
  /** Persists the new bibText (e.g. updateFileText(bibPath, next)) — omitted when there's no .bib to write to. */
  onWriteBib?: (nextBibText: string) => void;
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

const SORT_OPTIONS: { mode: SortMode; label: "sortFile" | "sortAuthor" | "sortYear" }[] =
  [
    { mode: "file", label: "sortFile" },
    { mode: "author", label: "sortAuthor" },
    { mode: "year", label: "sortYear" },
  ];

export function ReferencesPanel({ bibText, onWriteBib }: ReferencesPanelProps) {
  const [sort, setSort] = useState<SortMode>("file");
  const [showRaw, setShowRaw] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addInitialTitle, setAddInitialTitle] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [addedToastKey, setAddedToastKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const existingDois = useMemo(() => {
    if (bibText === null) return new Set<string>();
    const file = parseBibFile(bibText);
    const dois = new Set<string>();
    for (const chunk of file.chunks) {
      if (chunk.kind !== "entry" || isParseFailure(chunk.parsed)) continue;
      const doi = chunk.parsed.fields.get("doi")?.value;
      if (doi) dois.add(doi.toLowerCase());
    }
    return dois;
  }, [bibText]);

  const commitEntry = (input: NewEntryInput): boolean => {
    if (bibText === null || !onWriteBib) return false;
    const result = addEntry(bibText, input);
    if (!result.ok) {
      setAddError(strings.references.saveError);
      return false;
    }
    onWriteBib(result.value.bibText);
    setAddError(null);
    setAddedToastKey(result.value.citationKey);
    setCopied(false);
    return true;
  };

  const handleAdd = (input: NewEntryInput) => {
    if (commitEntry(input)) setAddOpen(false);
  };

  const handleSearchAdd = (candidate: ReferenceCandidate) => {
    commitEntry(candidateToNewEntryInput(candidate));
  };

  const openManualAdd = (initialTitle = "") => {
    setAddInitialTitle(initialTitle);
    setAddOpen(true);
  };

  const citeCommand = ABNT_CITATION_PROFILE.citeCommands[0];

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
      {onWriteBib && (
        <div className="flex gap-1.5 border-b p-2">
          <button
            type="button"
            data-testid="reference-search-toggle"
            onClick={() => setSearchOpen((v) => !v)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm",
              searchOpen
                ? "bg-accent text-accent-foreground"
                : "border bg-background hover:bg-accent-soft/40",
            )}
          >
            {searchOpen
              ? strings.references.searchBackToList
              : strings.references.searchButton}
          </button>
          {!searchOpen && (
            <button
              type="button"
              data-testid="add-reference-open"
              onClick={() => openManualAdd()}
              className="flex-1 rounded-md bg-accent px-3 py-1.5 text-accent-foreground text-sm hover:bg-accent-strong"
            >
              + {strings.references.addNew}
            </button>
          )}
        </div>
      )}

      {addedToastKey && (
        <div
          className="flex items-center justify-between gap-2 border-b bg-success/10 px-3 py-2 text-xs"
          data-testid="reference-added-toast"
        >
          <span>
            {strings.references.addedToastPrefix}{" "}
            <code className="font-mono">
              \{citeCommand}
              {"{"}
              {addedToastKey}
              {"}"}
            </code>
          </span>
          <button
            type="button"
            className="shrink-0 text-accent underline hover:no-underline"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(`\\${citeCommand}{${addedToastKey}}`)
                .then(() => setCopied(true));
            }}
          >
            {copied
              ? strings.references.addedToastCopied
              : strings.references.addedToastCopy}
          </button>
        </div>
      )}

      {searchOpen && onWriteBib ? (
        <ReferenceSearch
          existingDois={existingDois}
          onAdd={handleSearchAdd}
          onAddManually={(title) => {
            setSearchOpen(false);
            openManualAdd(title);
          }}
        />
      ) : (
        <>
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
                <div className="p-4 text-ink-muted text-sm">
                  {strings.references.empty}
                </div>
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
                      <span>{row.authorsLabel ?? strings.references.unknownAuthor}</span>{" "}
                      · <span>{row.yearLabel}</span>
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
        </>
      )}
      {addOpen && (
        <AddReferenceDialog
          initialTitle={addInitialTitle}
          onSubmit={handleAdd}
          onClose={() => {
            setAddOpen(false);
            setAddError(null);
            setAddInitialTitle("");
          }}
          error={addError}
        />
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
