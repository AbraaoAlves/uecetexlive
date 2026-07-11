/**
 * "Meu trabalho está certo?" (3.2) — read-only checklist over
 * computeComplianceChecklist's output. Same floating-modal shell as
 * MetadataWizard (QA §A3): editor/PDF preview stay visible underneath.
 * Every row's "corrigir" hands its ComplianceAction back to the caller,
 * which owns opening the wizard/references tab/file (AppShell already
 * owns those surfaces — this panel doesn't reach into them directly).
 */
import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import { useEffect } from "react";
import { strings } from "@/lib/strings";
import type { ComplianceAction, ComplianceCheck } from "./compliance-checklist";

export interface ComplianceChecklistProps {
  checks: ComplianceCheck[];
  onAction: (action: ComplianceAction) => void;
  onClose: () => void;
}

const COPY: Record<
  ComplianceCheck["id"],
  { ok: string; warnOne: string; warnMany: string }
> = {
  pretextual: {
    ok: strings.compliance.pretextualOk,
    warnOne: strings.compliance.pretextualWarnOne,
    warnMany: strings.compliance.pretextualWarnMany,
  },
  abstract: {
    ok: strings.compliance.abstractOk,
    warnOne: strings.compliance.abstractWarn,
    warnMany: strings.compliance.abstractWarn,
  },
  references: {
    ok: strings.compliance.referencesOk,
    warnOne: strings.compliance.referencesWarnOne,
    warnMany: strings.compliance.referencesWarnMany,
  },
  figures: {
    ok: strings.compliance.figuresOk,
    warnOne: strings.compliance.figuresWarnOne,
    warnMany: strings.compliance.figuresWarnMany,
  },
  orphanCitations: {
    ok: strings.compliance.orphanCitationsOk,
    warnOne: strings.compliance.orphanCitationsWarnOne,
    warnMany: strings.compliance.orphanCitationsWarnMany,
  },
  uncitedEntries: {
    ok: strings.compliance.uncitedEntriesOk,
    warnOne: strings.compliance.uncitedEntriesWarnOne,
    warnMany: strings.compliance.uncitedEntriesWarnMany,
  },
};

function messageFor(check: ComplianceCheck): string {
  const copy = COPY[check.id];
  if (check.status === "ok") return copy.ok;
  return (check.count === 1 ? copy.warnOne : copy.warnMany).replace(
    "{n}",
    String(check.count),
  );
}

export function ComplianceChecklist({
  checks,
  onAction,
  onClose,
}: ComplianceChecklistProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compliance-checklist-title"
      data-testid="compliance-checklist"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border bg-surface-elevated shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
        role="document"
      >
        <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
          <span id="compliance-checklist-title" className="font-display text-base">
            {strings.compliance.title}
          </span>
          <button
            type="button"
            data-testid="compliance-close"
            aria-label={strings.compliance.close}
            className="ml-auto rounded p-1.5 text-ink-muted hover:bg-accent-soft"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <ul className="flex flex-col gap-3">
            {checks.map((check) => (
              <li
                key={check.id}
                data-testid={`compliance-check-${check.id}`}
                data-status={check.status}
                className="flex items-start gap-2.5"
              >
                {check.status === "ok" ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                ) : (
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                )}
                <span className="flex-1 text-sm">{messageFor(check)}</span>
                {check.status === "warn" && check.action && (
                  <button
                    type="button"
                    data-testid={`compliance-fix-${check.id}`}
                    className="shrink-0 text-accent text-sm underline hover:no-underline"
                    onClick={() => {
                      if (check.action) onAction(check.action);
                    }}
                  >
                    {strings.compliance.fixAction}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
