import { useState } from "react";
import { strings } from "@/lib/strings";
import { ComplianceList, type ComplianceListProps } from "./ComplianceList";
import { pendingItemCount } from "./compliance-checklist";

export interface ComplianceRailProps extends ComplianceListProps {
  onNext?: () => void;
}

/**
 * Recebe a lista **já na ordem de correção** (`orderComplianceChecks`) e a
 * mostra como veio. A ordem é decisão de produto e quem a aplica é quem monta a
 * lista — a mesma que alimenta o "corrigir o próximo". Reordenar aqui de novo
 * criaria duas fontes para uma decisão só, e elas discordariam no primeiro dia
 * em que uma das duas mudasse.
 */
export function ComplianceRail({ checks, onNext, ...props }: ComplianceRailProps) {
  const pendingCount = pendingItemCount(checks);
  const [showOkChecks, setShowOkChecks] = useState(false);
  const allClear = pendingCount === 0;
  const summary = allClear
    ? strings.compliance.allClearRail
    : (pendingCount === 1
        ? strings.compliance.railSummaryOne
        : strings.compliance.railSummaryMany
      ).replace("{n}", String(pendingCount));

  return (
    <section className="flex h-full min-h-0 flex-col" data-testid="compliance-rail">
      <header className="shrink-0 border-b px-3 py-2">
        <h2 className="font-medium text-sm">{strings.rail.complianceTab}</h2>
        <p className="text-ink-subtle text-xs" data-testid="compliance-rail-summary">
          {summary}
        </p>
        {!allClear && onNext && (
          <button
            type="button"
            data-testid="compliance-next-all"
            className="mt-1 text-accent text-xs underline hover:no-underline"
            onClick={onNext}
          >
            {strings.compliance.nextOverall}
          </button>
        )}
        {allClear && (
          <button
            type="button"
            data-testid="compliance-show-ok"
            className="mt-1 text-accent text-xs underline hover:no-underline"
            onClick={() => setShowOkChecks((shown) => !shown)}
          >
            {showOkChecks
              ? strings.compliance.hideOkItems
              : strings.compliance.showOkItems}
          </button>
        )}
      </header>
      {(!allClear || showOkChecks) && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <ComplianceList checks={checks} {...props} />
        </div>
      )}
    </section>
  );
}
