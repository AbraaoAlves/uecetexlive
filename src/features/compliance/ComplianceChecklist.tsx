/**
 * "Meu trabalho está certo?" (3.2) — read-only checklist over
 * computeComplianceChecklist's output. Same floating-modal shell as
 * MetadataWizard (QA §A3): editor/PDF preview stay visible underneath.
 * Every row's "corrigir" hands its ComplianceAction back to the caller,
 * which owns opening the wizard/references tab/file (AppShell already
 * owns those surfaces — this panel doesn't reach into them directly).
 */
import { CheckCircle2, HelpCircle, ImageOff, TriangleAlert, X } from "lucide-react";
import { useEffect } from "react";
import { strings } from "@/lib/strings";
import type {
  ComplianceAction,
  ComplianceCheck,
  ComplianceItem,
  ComplianceReviewAction,
} from "./compliance-checklist";

export interface ComplianceChecklistProps {
  checks: ComplianceCheck[];
  onAction: (action: ComplianceAction) => void;
  onReviewAction?: (action: ComplianceReviewAction) => void;
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
  importPdf: {
    ok: strings.compliance.importPdfOk,
    warnOne: strings.compliance.importPdfWarnOne,
    warnMany: strings.compliance.importPdfWarnMany,
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

function ComplianceItemIcon({ item }: { item: ComplianceItem }) {
  const className = `mt-0.5 size-4 shrink-0 ${
    item.reason === "sem-legenda-e-fonte" ? "text-danger" : "text-warning"
  }`;
  if (item.reason === "sem-legenda") {
    return (
      <ImageOff
        className={className}
        data-testid={`compliance-item-icon-${item.id}`}
        data-icon="image-off"
      />
    );
  }
  if (item.reason === "sem-fonte") {
    return (
      <HelpCircle
        className={className}
        data-testid={`compliance-item-icon-${item.id}`}
        data-icon="help-circle"
      />
    );
  }
  return (
    <TriangleAlert
      className={className}
      data-testid={`compliance-item-icon-${item.id}`}
      data-icon="triangle-alert"
    />
  );
}

export function ComplianceChecklist({
  checks,
  onAction,
  onReviewAction,
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
                className="flex flex-col gap-2"
              >
                <div className="flex items-start gap-2.5">
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
                </div>
                {check.id === "importPdf" &&
                  check.items?.some((item) => item.reviewAction) && (
                    <p
                      className="ml-6 text-ink-subtle text-xs"
                      data-testid="compliance-marker-hint"
                    >
                      {strings.compliance.markerHint}
                    </p>
                  )}
                {check.status === "warn" && check.items && check.items.length > 0 && (
                  <ul className="ml-6 flex flex-col gap-1.5">
                    {check.items.map((item) => {
                      const danger = item.reason === "sem-legenda-e-fonte";
                      return (
                        <li
                          key={item.id}
                          data-testid={`compliance-item-${item.id}`}
                          data-reason={item.reason}
                          data-tone={danger ? "danger" : "warning"}
                          aria-label={
                            item.detail ? `${item.label}. ${item.detail}` : item.label
                          }
                          className={`flex items-start gap-2 rounded border px-2.5 py-2 ${
                            danger ? "border-danger/30 text-danger" : "text-ink-muted"
                          }`}
                        >
                          <ComplianceItemIcon item={item} />
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-sm">
                              {item.label}
                            </span>
                            {item.detail && (
                              <span className="block text-xs opacity-90">
                                {item.detail}
                              </span>
                            )}
                          </span>
                          {item.action && (
                            <button
                              type="button"
                              data-testid={`compliance-item-fix-${item.id}`}
                              className="shrink-0 text-accent text-xs underline hover:no-underline"
                              onClick={() => {
                                if (item.action) onAction(item.action);
                              }}
                            >
                              {strings.compliance.fixAction}
                            </button>
                          )}
                          {item.reviewAction && onReviewAction && (
                            <button
                              type="button"
                              data-testid={`compliance-item-review-${item.id}`}
                              className="shrink-0 text-accent text-xs underline hover:no-underline"
                              onClick={() => {
                                if (item.reviewAction) onReviewAction(item.reviewAction);
                              }}
                            >
                              {strings.compliance.markerReviewedAction}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
