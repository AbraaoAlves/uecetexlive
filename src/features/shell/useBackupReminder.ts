/**
 * Bookkeeping half of the backup reminder (3.5) — see backup-reminder.ts for
 * the pure threshold check. Counts one session per mount and accumulates
 * wall-clock minutes while the tab is visible, both persisted in UiSettings
 * so they survive reloads (same store useUiSettings already writes to).
 */
import type { UiSettings } from "@papyru/project-model";
import { useEffect, useRef } from "react";
import { shouldShowBackupReminder } from "./backup-reminder";

const TICK_MS = 30_000;

export interface UseBackupReminder {
  showReminder: boolean;
  /** Call after an export, or on dismiss — pushes the next reminder N sessions/M minutes out. */
  resetReminder: () => void;
}

export function useBackupReminder(
  ui: UiSettings,
  setUi: (patch: Partial<UiSettings>) => void,
  ready: boolean,
): UseBackupReminder {
  const uiRef = useRef(ui);
  uiRef.current = ui;
  const bootedRef = useRef(false);

  // One session per real mount — guarded so StrictMode's dev double-invoke
  // (mount→unmount→mount within the same tick) doesn't double-count.
  useEffect(() => {
    if (!ready || bootedRef.current) return;
    bootedRef.current = true;
    setUi({ sessionCount: uiRef.current.sessionCount + 1 });
  }, [ready, setUi]);

  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setUi({ cumulativeEditMs: uiRef.current.cumulativeEditMs + TICK_MS });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [ready, setUi]);

  const resetReminder = () => {
    setUi({
      backupReminderBaselineSession: uiRef.current.sessionCount,
      backupReminderBaselineEditMs: uiRef.current.cumulativeEditMs,
    });
  };

  return { showReminder: ready && shouldShowBackupReminder(ui), resetReminder };
}
