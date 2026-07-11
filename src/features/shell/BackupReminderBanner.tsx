/**
 * "Baixe uma cópia de segurança (.zip)" (3.5) — non-intrusive, same shell as
 * TemplateUpdateBanner/EngineUpdateBanner. Both "Exportar agora" and
 * "Depois" push the next reminder N sessions/M minutes out (useBackupReminder's
 * resetReminder) — dismissing isn't a backup, but it's still "handled for now".
 */
import { strings } from "@/lib/strings";

export interface BackupReminderBannerProps {
  onExport: () => void;
  onDismiss: () => void;
}

export function BackupReminderBanner({ onExport, onDismiss }: BackupReminderBannerProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-b bg-accent-soft px-3 py-1.5 text-sm"
      data-testid="backup-reminder-banner"
    >
      <span>{strings.shell.backupReminderMessage}</span>
      <span className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          data-testid="backup-reminder-export"
          className="rounded px-2 py-0.5 text-accent-strong hover:bg-surface"
          onClick={onExport}
        >
          {strings.shell.backupReminderExport}
        </button>
        <button
          type="button"
          data-testid="backup-reminder-dismiss"
          className="rounded px-2 py-0.5 text-ink-muted hover:bg-surface"
          onClick={onDismiss}
        >
          {strings.shell.backupReminderDismiss}
        </button>
      </span>
    </div>
  );
}
