/**
 * As três telas da importação de PDF: progresso, relatório e erro.
 *
 * O relatório existe para não prometer o que não entregamos — "importar PDF"
 * soa como fidelidade total, e não é. Antes de criar o projeto o aluno vê o
 * que reconhecemos e o que vai precisar da mão dele.
 */

import type { EmitReport } from "@papyru/inverse-core";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { strings } from "@/lib/strings";
import type { ImportStage } from "./protocol";
import { reportCounts, reportPendencies } from "./report-summary";

export type ImportPdfState =
  | { kind: "running"; stage: ImportStage; pct: number }
  | { kind: "report"; report: EmitReport; fileCount: number }
  | { kind: "error"; message: string }
  | { kind: "low-confidence" };

export interface ImportPdfDialogProps {
  state: ImportPdfState;
  onConfirm: () => void;
  onClose: () => void;
  /** Segue com o PDF fora do perfil do modelo. */
  onForce?: () => void;
}

const STAGE_LABEL: Record<ImportStage, string> = {
  lendo: strings.importPdf.stageLendo,
  reconhecendo: strings.importPdf.stageReconhecendo,
  montando: strings.importPdf.stageMontando,
};

const TITLE_ID = "import-pdf-title";

export function ImportPdfDialog({
  state,
  onConfirm,
  onClose,
  onForce,
}: ImportPdfDialogProps) {
  // Foco entra no diálogo ao abrir: sem isso o Escape não chega e o leitor de
  // tela continua lendo a página atrás.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => panelRef.current?.focus(), []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      data-testid="import-pdf-dialog"
      onClick={state.kind === "running" ? undefined : onClose}
      onKeyDown={(e) => e.key === "Escape" && state.kind !== "running" && onClose()}
    >
      <div
        ref={panelRef}
        // Fora da ordem de tabulação, mas focável por código: é assim que o
        // foco entra no diálogo e o Escape passa a chegar.
        tabIndex={-1}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border bg-surface-elevated p-5 shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
        role="document"
      >
        <div className="flex items-center gap-2">
          <span id={TITLE_ID} className="font-display text-lg">
            {strings.importPdf.title}
          </span>
          <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[10px] text-warning uppercase tracking-wider">
            {strings.importPdf.experimental}
          </span>
        </div>

        {state.kind === "running" && (
          <div className="mt-4" data-testid="import-pdf-running">
            <p className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              {STAGE_LABEL[state.stage]}
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface">
              <div
                className="h-full bg-accent transition-[width]"
                style={{ width: `${Math.round(state.pct * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-ink-subtle text-xs">{strings.importPdf.intro}</p>
          </div>
        )}

        {state.kind === "report" && (
          <div className="mt-4 min-h-0 overflow-y-auto" data-testid="import-pdf-report">
            <div className="font-medium text-[11px] text-ink-subtle uppercase tracking-wider">
              {strings.importPdf.reportTitle}
            </div>
            <ul className="mt-1 list-inside list-disc text-sm">
              {reportCounts(state.report).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {reportPendencies(state.report).length > 0 && (
              <>
                <div className="mt-4 font-medium text-[11px] text-ink-subtle uppercase tracking-wider">
                  {strings.importPdf.pendingTitle}
                </div>
                <ul
                  className="mt-1 list-inside list-disc text-sm text-warning"
                  data-testid="import-pdf-pendencies"
                >
                  {reportPendencies(state.report).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-4 text-ink-subtle text-xs">
              {strings.importPdf.replaceWarning}
            </p>
          </div>
        )}

        {state.kind === "low-confidence" && (
          <div className="mt-4" data-testid="import-pdf-low-confidence">
            <p className="flex items-start gap-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {strings.importPdf.lowConfidence}
            </p>
          </div>
        )}

        {state.kind === "error" && (
          <div className="mt-4" data-testid="import-pdf-error">
            <p className="flex items-start gap-2 text-danger text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {state.message}
            </p>
          </div>
        )}

        <div className="mt-5 flex shrink-0 justify-end gap-2">
          <button
            type="button"
            data-testid="import-pdf-cancel"
            disabled={state.kind === "running"}
            className="rounded px-3 py-1.5 text-ink-muted text-sm hover:bg-surface disabled:opacity-40"
            onClick={onClose}
          >
            {state.kind === "error" ? strings.importPdf.retry : strings.importPdf.cancel}
          </button>
          {state.kind === "low-confidence" && onForce && (
            <button
              type="button"
              data-testid="import-pdf-force"
              className="rounded border px-3 py-1.5 text-sm hover:bg-accent-soft"
              onClick={onForce}
            >
              {strings.importPdf.tryAnyway}
            </button>
          )}
          {state.kind === "report" && (
            <button
              type="button"
              data-testid="import-pdf-confirm"
              className="rounded bg-accent px-3 py-1.5 text-accent-foreground text-sm hover:bg-accent-strong"
              onClick={onConfirm}
            >
              {strings.importPdf.create}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
