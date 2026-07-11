import { describe, expect, it } from "vitest";
import {
  BACKUP_REMINDER_EDIT_MS,
  BACKUP_REMINDER_SESSIONS,
  shouldShowBackupReminder,
} from "./backup-reminder";

const FRESH = {
  sessionCount: 0,
  cumulativeEditMs: 0,
  backupReminderBaselineSession: 0,
  backupReminderBaselineEditMs: 0,
};

describe("shouldShowBackupReminder", () => {
  it("stays false right after a reset", () => {
    expect(shouldShowBackupReminder(FRESH)).toBe(false);
  });

  it("fires once the session threshold is reached", () => {
    expect(
      shouldShowBackupReminder({ ...FRESH, sessionCount: BACKUP_REMINDER_SESSIONS }),
    ).toBe(true);
    expect(
      shouldShowBackupReminder({ ...FRESH, sessionCount: BACKUP_REMINDER_SESSIONS - 1 }),
    ).toBe(false);
  });

  it("fires once the edit-time threshold is reached", () => {
    expect(
      shouldShowBackupReminder({ ...FRESH, cumulativeEditMs: BACKUP_REMINDER_EDIT_MS }),
    ).toBe(true);
    expect(
      shouldShowBackupReminder({
        ...FRESH,
        cumulativeEditMs: BACKUP_REMINDER_EDIT_MS - 1,
      }),
    ).toBe(false);
  });

  it("measures from the baseline, not from zero", () => {
    const ui = {
      sessionCount: 10,
      cumulativeEditMs: 999_000,
      backupReminderBaselineSession: 8, // only 2 sessions since the last export
      backupReminderBaselineEditMs: 990_000, // only 9s of edit time since
    };
    expect(shouldShowBackupReminder(ui)).toBe(false);
  });

  it("either condition alone is enough (OR, not AND)", () => {
    expect(
      shouldShowBackupReminder({
        ...FRESH,
        sessionCount: BACKUP_REMINDER_SESSIONS,
        cumulativeEditMs: 0,
      }),
    ).toBe(true);
  });
});
