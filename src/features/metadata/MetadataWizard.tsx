/**
 * "Dados do Trabalho" wizard (F2) — stepper over WIZARD_STEPS, rendered as a
 * floating modal (QA §A3) so the editor and PDF preview keep their place
 * underneath. Text fields commit on blur (autosave philosophy — no Save
 * button); selects/radios commit on change. Fields whose macro is missing
 * from documento.tex render disabled.
 */
import { X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
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
import { WizardField } from "./WizardField";

export interface MetadataWizardProps {
  fields: ReadonlyMap<string, MetadataField>;
  onApply: (updates: Map<string, string>) => void;
  onClose: () => void;
  /** Etapa inicial (0-based) — usado pelas stories. */
  initialStep?: number;
  /** O projeto já está gravado? Governa o selo "salvo" dos campos. */
  persisted?: boolean;
}

export function MetadataWizard({
  fields,
  onApply,
  onClose,
  initialStep = 0,
  persisted = true,
}: MetadataWizardProps) {
  const [stepIndex, setStepIndex] = useState(initialStep);
  const stepBodyRef = useRef<HTMLDivElement>(null);

  const workType = workTypeOf(fields);
  const step = WIZARD_STEPS[stepIndex] ?? WIZARD_STEPS[0];
  const visibleFields = (step?.fields ?? []).filter(
    (f) => !f.showWhen || f.showWhen(workType, fields),
  );

  // Trocar de etapa põe o cursor no primeiro campo utilizável dela.
  const firstFieldMacro = visibleFields[0]?.macro;
  useEffect(() => {
    if (!firstFieldMacro) return;
    stepBodyRef.current
      ?.querySelector<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      )
      ?.focus();
  }, [firstFieldMacro]);

  // Global Escape: the modal must dismiss even when focus sits outside it
  // (e.g. right after the rail button that opened it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!step) return null;
  const isLast = stepIndex === WIZARD_STEPS.length - 1;

  const commit = (def: FieldDef, raw: string): boolean => {
    // Textarea bodies (resumo/abstract) are "everything before a known
    // macro" (resumo-field.ts), not a single-line value — trimming would
    // eat the paragraph's own trailing spacing on every untouched blur.
    const value = def.verbatim
      ? raw
      : escapeMetadataValue(def.kind === "textarea" ? raw : raw.trim());
    const current = fields.get(def.macro)?.value;
    if (current === undefined || current === value) return false;
    const updates = new Map([[def.macro, value]]);
    if (def.macro === "ehuab" && value === "nao") {
      const polo = fields.get("localdopolo");
      if (polo && polo.value !== "") updates.set("localdopolo", "");
    }
    onApply(updates);
    return true;
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
        className="flex h-[42rem] max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border bg-surface-elevated shadow-xl"
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
                  <span className="hidden md:inline"> · {s.short}</span>
                </button>
              </Tooltip>
            ))}
          </nav>
          <Tooltip content={strings.metadata.close}>
            <button
              type="button"
              data-testid="wizard-close"
              aria-label={strings.metadata.close}
              className="ml-auto rounded p-1.5 text-ink-muted hover:bg-accent-soft"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </Tooltip>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="w-full px-6 py-4">
            <h2 className="font-display text-xl">{step.title}</h2>
            {step.description && (
              <p className="mt-1 text-ink-muted text-sm">{step.description}</p>
            )}
            {showTheme && (
              <p className="mt-1 text-ink-subtle text-sm">
                {strings.metadata.themeContext} “{titulo}”
              </p>
            )}
            <div
              ref={stepBodyRef}
              className={cn(
                "mt-4 grid grid-cols-1 gap-x-4 gap-y-3",
                step.columns === 3 ? "md:grid-cols-3" : "md:grid-cols-2",
              )}
            >
              {visibleFields.map((def) => (
                <Fragment key={def.macro}>
                  {def.section && (
                    <div className="mt-1 border-b pb-1 font-medium text-[11px] text-ink-subtle uppercase tracking-wider md:col-span-full">
                      {def.section}
                    </div>
                  )}
                  <WizardField
                    def={def}
                    field={fields.get(def.macro)}
                    onCommit={commit}
                    persisted={persisted}
                  />
                </Fragment>
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
