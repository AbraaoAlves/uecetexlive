/**
 * Um campo do guia do trabalho.
 *
 * Vive separado do guia para manter os campos e suas regras reutilizáveis.
 *
 * Campos de texto gravam no blur (filosofia de salvamento automático, sem
 * botão Salvar); seleções e opções gravam na mudança. Campo cuja macro não
 * existe no documento aparece desabilitado.
 */
import { AlertTriangle, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MetadataField } from "@/features/project/metadata";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import type { FieldDef } from "./fields";

/** Quanto tempo o selo "salvo" fica visível depois do blur. */
const SAVED_BADGE_MS = 1500;

export function WizardField({
  def,
  field,
  onCommit,
  persisted,
}: {
  def: FieldDef;
  field: MetadataField | undefined;
  onCommit: (def: FieldDef, raw: string) => boolean;
  persisted: boolean;
}) {
  const missing = field === undefined;
  const current = field?.value ?? "";
  const inputId = `metadata-input-${def.macro}`;
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  const handleCommit = (raw: string) => {
    if (!onCommit(def, raw)) return;
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), SAVED_BADGE_MS);
  };

  const problem = def.validate?.(current) ?? null;
  const wide = def.kind === "textarea" || def.kind === "radio";

  return (
    <div className={cn(wide && "md:col-span-full")}>
      {def.kind === "radio" && def.options ? (
        <fieldset disabled={missing}>
          <legend className="mb-2 block text-ink-muted text-xs">{def.label}</legend>
          <div className="grid gap-2 md:grid-cols-2">
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
                  onChange={() => handleCommit(opt.value)}
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
          <label
            htmlFor={inputId}
            className="mb-1 flex items-center gap-1.5 text-ink-muted text-xs"
          >
            {def.label}
            {saved && persisted && (
              <span
                className="flex items-center gap-0.5 text-success"
                data-testid={`field-saved-${def.macro}`}
              >
                <Check className="size-3" />
                {strings.metadata.savedBadge}
              </span>
            )}
          </label>
          {def.kind === "textarea" ? (
            <textarea
              key={`${def.macro}:${current}`}
              id={inputId}
              rows={8}
              data-testid={`metadata-field-${def.macro}`}
              disabled={missing}
              defaultValue={current}
              onBlur={(e) => handleCommit(e.target.value)}
              className="w-full resize-y rounded-md border bg-surface-elevated px-2.5 py-1.5 text-sm disabled:opacity-50"
            />
          ) : def.kind === "select" && def.options ? (
            <select
              id={inputId}
              data-testid={`metadata-field-${def.macro}`}
              disabled={missing}
              value={current.trim()}
              onChange={(e) => handleCommit(e.target.value)}
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
              onBlur={(e) => handleCommit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="w-full rounded-md border bg-surface-elevated px-2.5 py-1.5 text-sm disabled:opacity-50"
            />
          )}
        </div>
      )}
      {problem && !missing && (
        <p
          className="mt-1 text-warning text-xs"
          role="status"
          data-testid={`field-warning-${def.macro}`}
        >
          {problem}
        </p>
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
