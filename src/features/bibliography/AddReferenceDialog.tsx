/**
 * "+ Nova referência" (B3 — §5.7/§5.9 UI_UX_PLAN): picker de tipo → form
 * por tipo → NewEntryInput. Nunca mostra `{}`, `@` ou "BibTeX" — o único
 * lugar onde o usuário vê a citation key é a seção "Avançado", já
 * preenchida (buildCitationKey) e editável.
 */
import {
  buildCitationKey,
  ENTRY_FIELD_SPECS,
  ENTRY_TYPE_LABELS_PT,
  ENTRY_TYPES,
  type EntryType,
  type NewEntryInput,
} from "@papyru/bibliography";
import { useEffect, useMemo, useState } from "react";
import { strings } from "@/lib/strings";
import { type AuthorInput, emptyAuthor, serializeAuthors } from "./author-list";
import { EntryTypeIcon } from "./entry-type-icon";

export interface AddReferenceDialogProps {
  onSubmit: (input: NewEntryInput) => void;
  onClose: () => void;
  error: string | null;
  /** Pre-fills the title, e.g. from a search query with no results (§5.7 B4). */
  initialTitle?: string;
}

type Step = "type" | "form";

export function AddReferenceDialog({
  onSubmit,
  onClose,
  error,
  initialTitle = "",
}: AddReferenceDialogProps) {
  const [step, setStep] = useState<Step>("type");
  const [type, setType] = useState<EntryType | null>(null);
  const [fields, setFields] = useState<Record<string, string>>(
    initialTitle ? { title: initialTitle } : {},
  );
  const [authors, setAuthors] = useState<AuthorInput[]>([emptyAuthor()]);
  const [citationKey, setCitationKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const specs = type ? ENTRY_FIELD_SPECS[type] : [];
  const nonAuthorSpecs = specs.filter((s) => s.name !== "author");
  const hasAuthorField = specs.some((s) => s.name === "author");
  const authorRequired = specs.find((s) => s.name === "author")?.required ?? false;

  // Auto-derive the citation key from author/year/title until the user
  // edits it by hand — same pattern search results will use in B4.
  useEffect(() => {
    if (keyTouched) return;
    setCitationKey(
      buildCitationKey({
        authorSurname: authors[0]?.lastName,
        year: fields.year,
        title: fields.title,
      }),
    );
  }, [authors, fields.year, fields.title, keyTouched]);

  const missingRequired = useMemo(() => {
    if (!type) return true;
    if (authorRequired && !authors.some((a) => a.lastName.trim())) return true;
    return nonAuthorSpecs.some((s) => s.required && !fields[s.name]?.trim());
  }, [type, authorRequired, authors, nonAuthorSpecs, fields]);

  const pickType = (t: EntryType) => {
    setType(t);
    setStep("form");
  };

  const submit = () => {
    if (!type || missingRequired) return;
    const fieldMap = new Map<string, string>();
    for (const spec of nonAuthorSpecs) {
      const value = fields[spec.name]?.trim();
      if (value) fieldMap.set(spec.name, value);
    }
    if (hasAuthorField) {
      const serialized = serializeAuthors(authors);
      if (serialized) fieldMap.set("author", serialized);
    }
    onSubmit({
      citationKey: citationKey.trim() || "referencia",
      entryType: type,
      fields: fieldMap,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="add-reference-dialog"
      onClick={onClose}
      onKeyDown={() => {}}
    >
      <div
        className="max-h-[85vh] w-[32rem] overflow-y-auto rounded-lg border bg-surface-elevated p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
        role="document"
      >
        {step === "type" ? (
          <>
            <div className="font-display text-lg">{strings.references.pickTypeTitle}</div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {ENTRY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  data-testid={`reference-type-${t}`}
                  onClick={() => pickType(t)}
                  className="flex items-start gap-3 rounded-md border p-3 text-left hover:border-accent hover:bg-accent-soft/40"
                >
                  <EntryTypeIcon type={t} className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <span className="block font-medium text-sm">
                      {ENTRY_TYPE_LABELS_PT[t]}
                    </span>
                    <span className="block text-ink-muted text-xs">
                      {strings.references.typeDescriptions[t]}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded px-3 py-1.5 text-ink-muted text-sm hover:bg-surface"
                onClick={onClose}
                data-testid="add-reference-cancel"
              >
                {strings.references.cancel}
              </button>
            </div>
          </>
        ) : (
          type && (
            <>
              <div className="flex items-center gap-2 font-display text-lg">
                <EntryTypeIcon type={type} className="size-4" />
                {ENTRY_TYPE_LABELS_PT[type]}
              </div>

              {hasAuthorField && (
                <AuthorsField
                  authors={authors}
                  onChange={setAuthors}
                  required={authorRequired}
                />
              )}

              {nonAuthorSpecs.map((spec) => (
                <div key={spec.name} className="mt-3">
                  <label
                    className="block text-ink-muted text-xs"
                    htmlFor={`ref-field-${spec.name}`}
                  >
                    {spec.labelPt}
                    {spec.required && (
                      <span className="text-danger">
                        {" "}
                        ({strings.references.requiredHint})
                      </span>
                    )}
                  </label>
                  <input
                    id={`ref-field-${spec.name}`}
                    data-testid={`reference-field-${spec.name}`}
                    type="text"
                    value={fields[spec.name] ?? ""}
                    onChange={(e) =>
                      setFields((prev) => ({ ...prev, [spec.name]: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              ))}

              <details
                className="mt-4"
                open={advancedOpen}
                onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
              >
                <summary className="cursor-pointer text-ink-muted text-xs">
                  {strings.references.advancedSection}
                </summary>
                <div className="mt-2">
                  <label
                    className="block text-ink-muted text-xs"
                    htmlFor="reference-citation-key"
                  >
                    {strings.references.citationKeyLabel}
                  </label>
                  <input
                    id="reference-citation-key"
                    data-testid="reference-citation-key"
                    type="text"
                    value={citationKey}
                    onChange={(e) => {
                      setKeyTouched(true);
                      setCitationKey(e.target.value);
                    }}
                    className="mt-1 w-full rounded-md border bg-background px-2.5 py-1.5 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                  <p className="mt-1 text-ink-subtle text-xs">
                    {strings.references.citationKeyHint}
                  </p>
                </div>
              </details>

              {error && <p className="mt-3 text-danger text-sm">{error}</p>}

              <div className="mt-4 flex justify-between gap-2">
                <button
                  type="button"
                  className="rounded px-3 py-1.5 text-ink-muted text-sm hover:bg-surface"
                  onClick={() => setStep("type")}
                  data-testid="add-reference-back"
                >
                  {strings.references.back}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded px-3 py-1.5 text-ink-muted text-sm hover:bg-surface"
                    onClick={onClose}
                    data-testid="add-reference-cancel"
                  >
                    {strings.references.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={missingRequired}
                    className="rounded bg-accent px-3 py-1.5 text-accent-foreground text-sm hover:bg-accent-strong disabled:opacity-40"
                    onClick={submit}
                    data-testid="add-reference-submit"
                  >
                    {strings.references.save}
                  </button>
                </div>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}

function AuthorsField({
  authors,
  onChange,
  required,
}: {
  authors: AuthorInput[];
  onChange: (authors: AuthorInput[]) => void;
  required: boolean;
}) {
  const update = (i: number, patch: Partial<AuthorInput>) =>
    onChange(authors.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const remove = (i: number) => onChange(authors.filter((_, idx) => idx !== i));

  return (
    <div className="mt-3">
      <span className="block text-ink-muted text-xs">
        {strings.references.authorsLabel}
        {required && (
          <span className="text-danger"> ({strings.references.requiredHint})</span>
        )}
      </span>
      <div className="mt-1 flex flex-col gap-1.5">
        {authors.map((author, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id, list is edited in place
          <div key={i} className="flex gap-1.5">
            <input
              type="text"
              data-testid={`reference-author-first-${i}`}
              placeholder={strings.references.firstNamePlaceholder}
              value={author.firstName}
              onChange={(e) => update(i, { firstName: e.target.value })}
              className="w-1/2 rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="text"
              data-testid={`reference-author-last-${i}`}
              placeholder={strings.references.lastNamePlaceholder}
              value={author.lastName}
              onChange={(e) => update(i, { lastName: e.target.value })}
              className="w-1/2 rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            {authors.length > 1 && (
              <button
                type="button"
                aria-label={strings.references.removeAuthor}
                className="px-1 text-ink-subtle hover:text-danger"
                onClick={() => remove(i)}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        data-testid="reference-add-author"
        className="mt-1.5 text-accent text-xs underline hover:no-underline"
        onClick={() => onChange([...authors, emptyAuthor()])}
      >
        {strings.references.addAuthor}
      </button>
    </div>
  );
}
