import { X } from "lucide-react";
import { useEffect } from "react";
import { strings } from "@/lib/strings";
import { ComplianceList } from "./ComplianceList";
import type {
  CheckId,
  ComplianceAction,
  ComplianceCheck,
  ComplianceReviewAction,
} from "./compliance-checklist";

export interface ComplianceChecklistProps {
  checks: ComplianceCheck[];
  onAction: (action: ComplianceAction) => void;
  onNext?: (checkId: CheckId) => void;
  onReviewAction?: (action: ComplianceReviewAction) => void;
  currentItemId?: string | null;
  visitedItemIds?: ReadonlySet<string>;
  onClose: () => void;
}

/** Modal legado que reutiliza a lista também exibida no painel lateral. */
export function ComplianceChecklist({
  checks,
  onAction,
  onNext,
  onReviewAction,
  currentItemId,
  visitedItemIds,
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
          <ComplianceList
            checks={checks}
            onAction={onAction}
            onNext={onNext}
            onReviewAction={onReviewAction}
            currentItemId={currentItemId}
            visitedItemIds={visitedItemIds}
          />
        </div>
      </div>
    </div>
  );
}
