/**
 * First-run invitation (skippable) to fill the work metadata in the guide.
 * Dismissing persists welcomeSeen.
 */
import { strings } from "@/lib/strings";

export interface WelcomeDialogProps {
  /** Ausente quando a importação de PDF não está disponível. */
  onImportPdf?: () => void;
  onFill: () => void;
  onLater: () => void;
}

export function WelcomeDialog({ onFill, onLater, onImportPdf }: WelcomeDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30"
      role="dialog"
      aria-modal="true"
      data-testid="welcome-dialog"
    >
      <div className="w-[26rem] rounded-lg border bg-surface-elevated p-5 shadow-xl">
        <div className="font-display text-lg">{strings.metadata.welcomeTitle}</div>
        <p className="mt-2 text-ink-muted text-sm">{strings.metadata.welcomeBody}</p>
        {onImportPdf && (
          <button
            type="button"
            data-testid="welcome-import-pdf"
            className="mt-3 w-full rounded border px-3 py-1.5 text-sm hover:bg-accent-soft"
            onClick={onImportPdf}
          >
            {strings.importPdf.welcomeButton}
          </button>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            data-testid="welcome-later"
            className="rounded px-3 py-1.5 text-ink-muted text-sm hover:bg-surface"
            onClick={onLater}
          >
            {strings.metadata.welcomeLater}
          </button>
          <button
            type="button"
            data-testid="welcome-fill"
            className="rounded bg-accent px-3 py-1.5 text-accent-foreground text-sm hover:bg-accent-strong"
            onClick={onFill}
          >
            {strings.metadata.welcomeFill}
          </button>
        </div>
      </div>
    </div>
  );
}
