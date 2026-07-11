/**
 * "Lembrete não intrusivo de exportação" (3.5): fires every N sessions or M
 * minutes of the app being open+visible, whichever comes first, since the
 * last export or dismissal. Pure threshold check — kept separate from
 * useBackupReminder.ts's session/interval bookkeeping so it's trivially
 * testable (same split compliance-checklist.ts uses for its checks).
 */
export const BACKUP_REMINDER_SESSIONS = 5;
export const BACKUP_REMINDER_EDIT_MS = 20 * 60 * 1000;

export interface BackupReminderState {
  sessionCount: number;
  cumulativeEditMs: number;
  backupReminderBaselineSession: number;
  backupReminderBaselineEditMs: number;
}

export function shouldShowBackupReminder(ui: BackupReminderState): boolean {
  const sessionsSince = ui.sessionCount - ui.backupReminderBaselineSession;
  const editMsSince = ui.cumulativeEditMs - ui.backupReminderBaselineEditMs;
  return (
    sessionsSince >= BACKUP_REMINDER_SESSIONS || editMsSince >= BACKUP_REMINDER_EDIT_MS
  );
}
