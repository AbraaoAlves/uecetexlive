import { CheckCircle2, HelpCircle, ImageOff, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { strings } from "@/lib/strings";
import type {
  ComplianceAction,
  ComplianceCheck,
  ComplianceItem,
  ComplianceReviewAction,
} from "./compliance-checklist";

const COLLAPSE_AFTER = 3;

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

export function messageFor(check: ComplianceCheck): string {
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

export interface ComplianceListProps {
  checks: readonly ComplianceCheck[];
  onAction: (action: ComplianceAction) => void;
  onItemAction?: (item: ComplianceItem) => void;
  onReviewAction?: (action: ComplianceReviewAction) => void;
  currentItemId?: string | null;
  visitedItemIds?: ReadonlySet<string>;
}

interface ComplianceCheckRowProps {
  check: ComplianceCheck;
  onAction: (action: ComplianceAction) => void;
  onItemAction?: (item: ComplianceItem) => void;
  onReviewAction?: (action: ComplianceReviewAction) => void;
  currentItemId?: string | null;
  visitedItemIds?: ReadonlySet<string>;
}

function ComplianceCheckRow({
  check,
  onAction,
  onItemAction,
  onReviewAction,
  currentItemId,
  visitedItemIds,
}: ComplianceCheckRowProps) {
  const items = check.items ?? [];
  const hasItems = check.status === "warn" && items.length > 0;
  const [expanded, setExpanded] = useState(() => items.length <= COLLAPSE_AFTER);
  const containsCurrentItem =
    currentItemId !== null &&
    currentItemId !== undefined &&
    items.some((item) => item.id === currentItemId);
  const isExpanded = expanded || containsCurrentItem;
  const itemsId = `compliance-items-${check.id}`;
  const itemPrefix = `${check.id}-`;

  return (
    <li
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
        <span className="min-w-0 flex-1 text-sm">{messageFor(check)}</span>
        {hasItems && (
          <button
            type="button"
            data-testid={`compliance-expand-${check.id}`}
            aria-expanded={isExpanded}
            aria-controls={itemsId}
            className="shrink-0 text-accent text-xs underline hover:no-underline"
            onClick={() => setExpanded((value) => !value)}
          >
            {isExpanded
              ? strings.compliance.collapseItems
              : strings.compliance.expandItems}
          </button>
        )}
        {check.status === "warn" && check.action && !hasItems && (
          <button
            type="button"
            data-testid={`compliance-goto-${check.id}`}
            aria-label={`${strings.compliance.gotoItem}: ${messageFor(check)}`}
            className="shrink-0 text-accent text-sm underline hover:no-underline"
            onClick={() => onAction(check.action as ComplianceAction)}
          >
            {strings.compliance.gotoItem}
          </button>
        )}
      </div>
      {check.id === "importPdf" &&
        onReviewAction &&
        items.some((item) => item.reviewAction) && (
          <p
            className="ml-6 text-ink-subtle text-xs"
            data-testid="compliance-marker-hint"
          >
            {strings.compliance.markerHint}
          </p>
        )}
      {hasItems && isExpanded && (
        <ul id={itemsId} className="ml-6 flex flex-col gap-1.5">
          {items.map((item) => {
            const danger = item.reason === "sem-legenda-e-fonte";
            const visited = visitedItemIds?.has(item.id) ?? false;
            const itemTestId = `compliance-item-${itemPrefix}${item.id}`;
            return (
              <li
                key={item.id}
                data-testid={itemTestId}
                data-reason={item.reason}
                data-tone={danger ? "danger" : "warning"}
                data-current={currentItemId === item.id ? "true" : undefined}
                data-visited={visited ? "true" : undefined}
                aria-current={currentItemId === item.id ? "true" : undefined}
                aria-label={[
                  item.label,
                  item.detail,
                  visited ? strings.compliance.visitedItem : null,
                ]
                  .filter(Boolean)
                  .join(". ")}
                className={`flex items-start gap-2 rounded border px-2.5 py-2 ${
                  danger ? "border-danger/30 text-danger" : "text-ink-muted"
                } ${currentItemId === item.id ? "ring-2 ring-accent" : ""} ${
                  visited ? "opacity-70" : ""
                }`}
              >
                <ComplianceItemIcon item={item} />
                <span className="min-w-0 flex-1">
                  <span className={"block line-clamp-2 text-sm"}>{item.label}</span>
                  {visited && (
                    <span
                      className="mt-0.5 flex items-center gap-1 text-xs text-ink-subtle"
                      data-testid={`compliance-item-visited-${itemPrefix}${item.id}`}
                    >
                      <span role="img" aria-label={strings.compliance.visitedItem}>
                        <CheckCircle2 aria-hidden="true" className="size-3" />
                      </span>
                      <span>{strings.compliance.visitedItem}</span>
                    </span>
                  )}
                  {item.detail && (
                    <span
                      title={item.detail}
                      className="block truncate text-xs opacity-90"
                    >
                      {item.detail}
                    </span>
                  )}
                </span>
                {item.action ? (
                  <button
                    type="button"
                    data-testid={`compliance-goto-${check.id}-${item.id}`}
                    aria-label={`${strings.compliance.gotoItem}: ${item.label}`}
                    className="shrink-0 text-accent text-xs underline hover:no-underline"
                    onClick={() => {
                      onItemAction?.(item);
                      onAction(item.action as ComplianceAction);
                    }}
                  >
                    {strings.compliance.gotoItem}
                  </button>
                ) : (
                  <span className="shrink-0 text-ink-subtle text-xs">
                    {strings.compliance.notNavigable}
                  </span>
                )}
                {item.reviewAction && onReviewAction && (
                  <button
                    type="button"
                    data-testid={`compliance-item-review-${item.id}`}
                    aria-label={`${strings.compliance.markerReviewedAction}: ${item.label}`}
                    className="shrink-0 text-accent text-xs underline hover:no-underline"
                    onClick={() =>
                      onReviewAction(item.reviewAction as ComplianceReviewAction)
                    }
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
  );
}

export function ComplianceList({
  checks,
  onAction,
  onItemAction,
  onReviewAction,
  currentItemId,
  visitedItemIds,
}: ComplianceListProps) {
  return (
    <ul className="flex flex-col gap-3">
      {checks.map((check) => (
        <ComplianceCheckRow
          key={check.id}
          check={check}
          onAction={onAction}
          onItemAction={onItemAction}
          onReviewAction={onReviewAction}
          currentItemId={currentItemId}
          visitedItemIds={visitedItemIds}
        />
      ))}
    </ul>
  );
}
