/**
 * "Dados do Trabalho" wizard (F2) — stepper over WIZARD_STEPS, rendered as a
 * floating modal (QA §A3) so the editor and PDF preview keep their place
 * underneath. Text fields commit on blur (autosave philosophy — no Save
 * button); selects/radios commit on change. Fields whose macro is missing
 * from documento.tex render disabled.
 */
import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  escapeMetadataValue,
  type MetadataField,
  TEMPLATE_PLACEHOLDER_TITLE,
  workTypeOf,
} from "@/features/project/metadata";
import { Tooltip } from "@/features/shell/Tooltip";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { type FieldDef, WIZARD_STEPS } from "./fields";

export interface MetadataWizardProps {
  fields: ReadonlyMap<string, MetadataField>;
  onApply: (updates: Map<string, string>) => void;
  onClose: () => void;
}

export function MetadataWizard({ fields, onApply, onClose }: MetadataWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);

  // Global Escape: the modal must dismiss even when focus sits outside it
  // (e.g. right after the rail button that opened it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const workType = workTypeOf(fields);
  const step = WIZARD_STEPS[stepIndex] ?? WIZARD_STEPS[0];
  if (!step) return null;
  const visibleFields = step.fields.filter(
    (f) => !f.showWhen || f.showWhen(workType, fields),
  );
  const isLast = stepIndex === WIZARD_STEPS.length - 1;

  const commit = (def: FieldDef, raw: string) => {
    const value = def.verbatim ? raw : escapeMetadataValue(raw.trim());
    const current = fields.get(def.macro)?.value;
    if (current === undefined || current === value) return;
    const updates = new Map([[def.macro, value]]);
    if (def.macro === "ehuab" && value === "nao") {
      const polo = fields.get("localdopolo");
      if (polo && polo.value !== "") updates.set("localdopolo", "");
    }
    onApply(updates);
  };

  const titulo = fields.get("titulo")?.value.trim() ?? "";
  const showTheme =
    step.id === "tipo" && titulo !== "" && titulo !== TEMPLATE_PLACEHOLDER_TITLE;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="metadata-wizard"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {/* Fields commit on blur, so closing via the backdrop never loses input. */}
      <div
        className="flex h-[46rem] max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border bg-surface-elevated shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
        role="document"
      >
        <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
          <span className="font-display text-base">{strings.metadata.title}</span>
          <nav aria-label={strings.metadata.stepsLabel} className="flex gap-1">
            {WIZARD_STEPS.map((s, i) => (
              <Tooltip content={s.title} key={s.id}>
                <button
                  type="button"
                  data-testid={`wizard-step-${i + 1}`}
                  onClick={() => setStepIndex(i)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs",
                    i === stepIndex
                      ? "bg-accent-soft font-medium text-accent-strong"
                      : "text-ink-muted hover:bg-accent-soft/60",
                  )}
                >
                  {i + 1}
                </button>
              </Tooltip>
            ))}
          </nav>
          <Tooltip content={strings.metadata.close}>
            <button
              type="button"
              data-testid="wizard-close"
              className="ml-auto rounded p-1.5 text-ink-muted hover:bg-accent-soft"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </Tooltip>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="w-full px-6 py-5">
            <h2 className="font-display text-xl">{step.title}</h2>
            {step.description && (
              <p className="mt-1 text-ink-muted text-sm">{step.description}</p>
            )}
            {showTheme && (
              <p className="mt-1 text-ink-subtle text-sm">
                {strings.metadata.themeContext} “{titulo}”
              </p>
            )}
            <div className="mt-4 flex flex-col gap-4">
              {visibleFields.map((def) => (
                <WizardField
                  key={def.macro}
                  def={def}
                  field={fields.get(def.macro)}
                  onCommit={commit}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t px-6 py-3">
          <button
            type="button"
            data-testid="wizard-prev"
            disabled={stepIndex === 0}
            className="rounded px-3 py-1.5 text-ink-muted text-sm hover:bg-accent-soft disabled:opacity-40"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          >
            {strings.metadata.prev}
          </button>
          <span className="text-ink-subtle text-xs">
            {stepIndex + 1} / {WIZARD_STEPS.length}
          </span>
          <button
            type="button"
            data-testid="wizard-next"
            className="rounded bg-accent px-3 py-1.5 text-accent-foreground text-sm hover:bg-accent-strong"
            onClick={() =>
              isLast
                ? onClose()
                : setStepIndex((i) => Math.min(WIZARD_STEPS.length - 1, i + 1))
            }
          >
            {isLast ? strings.metadata.done : strings.metadata.next}
          </button>
        </div>
      </div>
    </div>
  );
}

function WizardField({
  def,
  field,
  onCommit,
}: {
  def: FieldDef;
  field: MetadataField | undefined;
  onCommit: (def: FieldDef, raw: string) => void;
}) {
  const missing = field === undefined;
  const current = field?.value ?? "";
  const inputId = `metadata-input-${def.macro}`;

  return (
    <div>
      {def.section && (
        <div className="mt-2 mb-2 border-b pb-1 font-medium text-[11px] text-ink-subtle uppercase tracking-wider">
          {def.section}
        </div>
      )}
      {def.kind === "radio" && def.options ? (
        <fieldset disabled={missing}>
          <legend className="mb-2 block text-ink-muted text-xs">{def.label}</legend>
          <div className="flex flex-col gap-2">
            {def.options.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-md border p-3",
                  current.trim() === opt.value
                    ? "border-accent bg-accent-soft"
                    : "hover:bg-accent-soft/40",
                )}
              >
                <input
                  type="radio"
                  name={def.macro}
                  value={opt.value}
                  data-testid={`metadata-option-${opt.value}`}
                  checked={current.trim() === opt.value}
                  onChange={() => onCommit(def, opt.value)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium text-sm">{opt.label}</span>
                  {opt.description && (
                    <span className="block text-ink-muted text-xs">
                      {opt.description}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div>
          <label htmlFor={inputId} className="mb-1 block text-ink-muted text-xs">
            {def.label}
          </label>
          {def.kind === "select" && def.options ? (
            <select
              id={inputId}
              data-testid={`metadata-field-${def.macro}`}
              disabled={missing}
              value={current.trim()}
              onChange={(e) => onCommit(def, e.target.value)}
              className="w-full rounded-md border bg-surface-elevated px-2.5 py-1.5 text-sm disabled:opacity-50"
            >
              {!def.options.some((o) => o.value === current.trim()) && (
                <option value={current.trim()}>{current.trim() || "—"}</option>
              )}
              {def.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              // Remount when the extracted value changes externally; while
              // typing (uncommitted) the key is stable, so state is kept.
              key={`${def.macro}:${current}`}
              id={inputId}
              type="text"
              inputMode={def.kind === "year" ? "numeric" : undefined}
              data-testid={`metadata-field-${def.macro}`}
              disabled={missing}
              defaultValue={current}
              onBlur={(e) => onCommit(def, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="w-full rounded-md border bg-surface-elevated px-2.5 py-1.5 text-sm disabled:opacity-50"
            />
          )}
        </div>
      )}
      {def.hint && !missing && <p className="mt-1 text-ink-subtle text-xs">{def.hint}</p>}
      {missing && (
        <p className="mt-1 flex items-center gap-1 text-warning text-xs">
          <AlertTriangle className="size-3 shrink-0" />
          {strings.metadata.missingMacro}
        </p>
      )}
    </div>
  );
}
