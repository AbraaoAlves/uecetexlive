import {
  addEntry,
  type BibliographyEntry,
  type Chunk,
  candidateToNewEntryInput,
  ENTRY_TYPE_LABELS_PT,
  type EntryPatch,
  type EntryTypeTag,
  entryTypeName,
  isKnownEntryType,
  isParseFailure,
  type NewEntryInput,
  parseBibFile,
  type ReferenceCandidate,
  removeEntry,
  updateEntry,
} from "@papyru/bibliography";
import { ABNT_CITATION_PROFILE } from "@papyru/latex-mapping";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { AddReferenceDialog, type EditingReference } from "./AddReferenceDialog";
import { countCitationUsages } from "./citation-usage";
import { EntryTypeIcon } from "./entry-type-icon";
import { formatAuthorsList } from "./format-authors";
import { missingFieldLabelsFor } from "./missing-fields";
import { ReferenceSearch } from "./ReferenceSearch";

export interface ReferencesPanelProps {
  /** null = no .bib discovered yet in the project (see include-graph). */
  bibText: string | null;
  /** Persists the new bibText (e.g. updateFileText(bibPath, next)) — omitted when there's no .bib to write to. */
  onWriteBib?: (nextBibText: string) => void;
  /** Set by "Citation undefined" (1.5/B5): opens search pre-run with the missing key. */
  initialSearchQuery?: string | null;
  onSearchQueryConsumed?: () => void;
  /** "Inserir citação no texto" per row (B5b) — omitted when no WYSIWYG surface is mounted to insert into. */
  onInsertCitation?: (key: string) => void;
  /** Every .tex file's current text, for the "used N times" warning before removing (B2). */
  texSources?: Record<string, string>;
  /** Chave a destacar: rola até a linha dela e põe o foco no botão de editar. */
  focusKey?: string | null;
  /** Muda para repetir o mesmo destaque (ver NavRequest.nonce no AppShell). */
  focusNonce?: number;
}

type SortMode = "file" | "author" | "year";
type FailureChunk = Extract<Chunk, { kind: "entry" }>;

interface ListRow {
  key: string;
  entry: BibliographyEntry;
  authorsLabel: string | null;
  titleLabel: string;
  yearLabel: string;
  missingFieldLabels: string[];
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

export function ReferencesPanel({
  bibText,
  onWriteBib,
  initialSearchQuery,
  onSearchQueryConsumed,
  onInsertCitation,
  texSources = {},
  focusKey,
  focusNonce,
}: ReferencesPanelProps) {
  const [sort, setSort] = useState<SortMode>("file");
  const [addOpen, setAddOpen] = useState(false);
  const [addInitialTitle, setAddInitialTitle] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [addedToastKey, setAddedToastKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyState, setCopyState] = useState<{ key: string; ok: boolean } | null>(null);
  const [editing, setEditing] = useState<EditingReference | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{
    key: string;
    usageCount: number;
  } | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSearchQuery) setSearchOpen(true);
  }, [initialSearchQuery]);

  // "Ir para esta referência": rolar não basta, porque a linha é um <li> e não
  // recebe foco — quem navega por teclado ou leitor de tela ficaria onde
  // estava. O foco vai para o botão de editar, que é a ação que a pessoa veio
  // fazer; se ele não existir (.bib somente leitura), vai para a própria linha.
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  // biome-ignore lint/correctness/useExhaustiveDependencies: focusNonce é o sinal de repetição — pedir a mesma chave duas vezes tem de destacar duas vezes
  useEffect(() => {
    if (!focusKey) return;
    const row = rowRefs.current.get(focusKey);
    if (!row) return;
    row.scrollIntoView({ block: "center" });
    const target =
      row.querySelector<HTMLElement>(`[data-testid="reference-edit-${focusKey}"]`) ?? row;
    target.focus();
  }, [focusKey, focusNonce]);

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

  const handleEditSubmit = (key: string, patch: EntryPatch) => {
    if (bibText === null || !onWriteBib) return;
    const result = updateEntry(bibText, key, patch);
    if (!result.ok) {
      setEditError(strings.references.saveError);
      return;
    }
    onWriteBib(result.value);
    setEditError(null);
    setEditing(null);
  };

  const openRemoveConfirm = (key: string) => {
    const usageCount = countCitationUsages(
      texSources,
      key,
      ABNT_CITATION_PROFILE.citeCommands,
    );
    setRemoveTarget({ key, usageCount });
  };

  const handleRemoveConfirm = () => {
    if (bibText === null || !onWriteBib || !removeTarget) return;
    const result = removeEntry(bibText, removeTarget.key);
    if (!result.ok) {
      setRemoveError(strings.references.removeError);
      return;
    }
    onWriteBib(result.value);
    setRemoveError(null);
    setRemoveTarget(null);
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
        missingFieldLabels: missingFieldLabelsFor(entry),
      });
    }
    return { rows, failures };
  }, [bibText]);

  const incompleteCount = rows.filter((r) => r.missingFieldLabels.length > 0).length;

  const sortedRows = useMemo(() => {
    const ordered =
      sort === "file"
        ? rows
        : [...rows].sort((a, b) =>
            sort === "author"
              ? (a.authorsLabel ?? "").localeCompare(b.authorsLabel ?? "")
              : a.yearLabel.localeCompare(b.yearLabel),
          );
    const incomplete: ListRow[] = [];
    const complete: ListRow[] = [];
    for (const row of ordered) {
      (row.missingFieldLabels.length > 0 ? incomplete : complete).push(row);
    }
    return [...incomplete, ...complete];
  }, [rows, sort]);

  if (bibText === null) {
    return (
      <div className="p-4 text-ink-muted text-sm" data-testid="references-empty">
        {strings.references.noBibFile}
      </div>
    );
  }

  return (
    // min-h-0/flex-1 em vez de h-full: o painel é filho de uma coluna flex que
    // já tem a barra de 36px em cima — com h-full ele estouraria essa altura.
    // max-w-3xl mantém a linha legível quando ele ocupa a área de edição
    // inteira (com o rail recolhido em 1366px isso passa de 700px).
    <div
      className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col"
      data-testid="references-panel"
    >
      {/* Trocar o rótulo do botão não é anunciado por leitor de tela; esta
          região é o que faz "copiado" (ou a falha) chegar a quem não vê. */}
      <output className="sr-only" aria-live="polite" data-testid="references-copy-status">
        {copyState === null
          ? ""
          : copyState.ok
            ? strings.references.copiedAnnouncement
            : strings.references.copyFailed}
      </output>
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
                .then(() => setCopied(true))
                .catch(() => {
                  // clipboard unavailable (permission denied, insecure context) — toast stays as "copiar"
                });
            }}
          >
            {copied
              ? strings.references.addedToastCopied
              : strings.references.addedToastCopy}
          </button>
        </div>
      )}

      {searchOpen && onWriteBib ? (
        <>
          {addError && (
            <div
              className="border-b bg-danger/10 px-3 py-2 text-danger text-xs"
              data-testid="reference-search-add-error"
            >
              {addError}
            </div>
          )}
          <ReferenceSearch
            existingDois={existingDois}
            initialQuery={initialSearchQuery ?? undefined}
            onInitialQueryConsumed={onSearchQueryConsumed}
            onAdd={handleSearchAdd}
            onAddManually={(title) => {
              setSearchOpen(false);
              openManualAdd(title);
            }}
          />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-xs">
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
          </div>

          {incompleteCount > 0 && (
            <div
              className="border-b bg-warning/10 px-3 py-1.5 text-warning text-xs"
              data-testid="references-incomplete-aggregate"
            >
              {incompleteCount === 1
                ? strings.references.incompleteAggregateOne
                : strings.references.incompleteAggregateMany.replace(
                    "{n}",
                    String(incompleteCount),
                  )}
            </div>
          )}

          {
            <div className="min-h-0 flex-1 overflow-y-auto">
              {rows.length === 0 && failures.length === 0 && (
                <div className="p-4 text-ink-muted text-sm">
                  {strings.references.empty}
                </div>
              )}
              <ul data-testid="references-list">
                {sortedRows.map((row, index) => (
                  <Fragment key={row.key}>
                    {incompleteCount > 0 && index === 0 && (
                      <li
                        className="border-b bg-warning/5 px-3 py-1.5 font-medium text-ink-muted text-xs"
                        data-testid="references-group-incomplete"
                      >
                        {strings.references.incompleteGroupLabel}
                      </li>
                    )}
                    {incompleteCount > 0 && index === incompleteCount && (
                      <li
                        className="border-b bg-surface px-3 py-1.5 font-medium text-ink-muted text-xs"
                        data-testid="references-group-complete"
                      >
                        {strings.references.completeGroupLabel}
                      </li>
                    )}
                    <li
                      ref={(el) => {
                        if (el) rowRefs.current.set(row.key, el);
                        else rowRefs.current.delete(row.key);
                      }}
                      tabIndex={-1}
                      className="border-b px-3 py-2 text-sm"
                      data-testid={`reference-${row.key}`}
                    >
                      <div className="flex items-center gap-1.5 text-ink-muted text-xs">
                        <EntryTypeIcon type={row.entry.entryType} />
                        <span>{entryTypeLabelPt(row.entry.entryType)}</span>
                      </div>
                      <div className="font-medium">{row.titleLabel}</div>
                      {row.missingFieldLabels.length > 0 && (
                        <div
                          className="mt-0.5 text-warning text-xs"
                          data-testid={`reference-incomplete-${row.key}`}
                        >
                          {strings.references.incompleteMissingPrefix}{" "}
                          {row.missingFieldLabels.join(", ")}.{" "}
                          {onWriteBib && isKnownEntryType(row.entry.entryType) && (
                            <button
                              type="button"
                              className="underline hover:no-underline"
                              onClick={() =>
                                setEditing({ citationKey: row.key, entry: row.entry })
                              }
                            >
                              {strings.references.incompleteAction}
                            </button>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-ink-muted text-xs">
                          <span>
                            {row.authorsLabel ?? strings.references.unknownAuthor}
                          </span>{" "}
                          · <span>{row.yearLabel}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-xs">
                          {onInsertCitation ? (
                            <button
                              type="button"
                              data-testid={`reference-insert-${row.key}`}
                              className="text-accent underline hover:no-underline"
                              onClick={() => onInsertCitation(row.key)}
                            >
                              {strings.references.insertCitation}
                            </button>
                          ) : (
                            // Sem um editor de texto montado ao lado não dá para
                            // saber onde está o cursor — inserir chutaria o
                            // arquivo. Copiar não depende de saber isso, e o
                            // caminho de inserir de verdade é o menu "/" de
                            // dentro do editor visual.
                            <button
                              type="button"
                              data-testid={`reference-copy-${row.key}`}
                              className="text-accent underline hover:no-underline"
                              onClick={() => {
                                const command = `\\${citeCommand}{${row.key}}`;
                                void navigator.clipboard
                                  ?.writeText(command)
                                  .then(() => setCopyState({ key: row.key, ok: true }))
                                  .catch(() => setCopyState({ key: row.key, ok: false }));
                              }}
                            >
                              {copyState?.key === row.key && copyState.ok
                                ? strings.references.copiedCitation
                                : strings.references.copyCitation}
                            </button>
                          )}
                          {onWriteBib && isKnownEntryType(row.entry.entryType) && (
                            <button
                              type="button"
                              data-testid={`reference-edit-${row.key}`}
                              className="text-ink-muted underline hover:no-underline"
                              onClick={() =>
                                setEditing({ citationKey: row.key, entry: row.entry })
                              }
                            >
                              {strings.references.editButton}
                            </button>
                          )}
                          {onWriteBib && (
                            <button
                              type="button"
                              data-testid={`reference-remove-${row.key}`}
                              className="text-danger underline hover:no-underline"
                              onClick={() => openRemoveConfirm(row.key)}
                            >
                              {strings.references.removeButton}
                            </button>
                          )}
                        </span>
                      </div>
                    </li>
                  </Fragment>
                ))}
              </ul>
              {failures.map((chunk, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: failures have no reliable key; replaced wholesale per parse
                <FailureCard key={i} chunk={chunk} />
              ))}
            </div>
          }
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
      {editing && (
        <AddReferenceDialog
          editing={editing}
          onSubmitEdit={handleEditSubmit}
          onClose={() => {
            setEditing(null);
            setEditError(null);
          }}
          error={editError}
        />
      )}
      {removeTarget && (
        <RemoveConfirmDialog
          usageCount={removeTarget.usageCount}
          error={removeError}
          onConfirm={handleRemoveConfirm}
          onCancel={() => {
            setRemoveTarget(null);
            setRemoveError(null);
          }}
        />
      )}
    </div>
  );
}

function RemoveConfirmDialog({
  usageCount,
  error,
  onConfirm,
  onCancel,
}: {
  usageCount: number;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="remove-reference-dialog"
      onClick={onCancel}
      onKeyDown={() => {}}
    >
      <div
        className="w-[26rem] rounded-lg border bg-surface-elevated p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
        role="document"
      >
        <div className="font-display text-lg">
          {strings.references.removeConfirmTitle}
        </div>
        {usageCount > 0 && (
          <p className="mt-2 text-danger text-sm" data-testid="remove-usage-warning">
            {usageCount === 1
              ? strings.references.removeConfirmUsedOne
              : strings.references.removeConfirmUsedMany.replace(
                  "{n}",
                  String(usageCount),
                )}
          </p>
        )}
        {error && <p className="mt-2 text-danger text-sm">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded px-3 py-1.5 text-ink-muted text-sm hover:bg-surface"
            onClick={onCancel}
            data-testid="remove-reference-cancel"
          >
            {strings.references.removeConfirmCancel}
          </button>
          <button
            type="button"
            className="rounded bg-danger px-3 py-1.5 text-sm text-white hover:bg-danger/90"
            onClick={onConfirm}
            data-testid="remove-reference-confirm"
          >
            {strings.references.removeConfirmButton}
          </button>
        </div>
      </div>
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
