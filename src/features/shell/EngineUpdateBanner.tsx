/**
 * Discreet notice that a new version already took over in the background
 * (useEngineUpdateNotice). Never forces a reload — autosave already
 * persists everything to IndexedDB, so it's safe, but the student's scroll
 * position/open dialogs are the student's to keep until they ask to reload.
 */
import { strings } from "@/lib/strings";

export interface EngineUpdateBannerProps {
  onReload: () => void;
  onDismiss: () => void;
}

export function EngineUpdateBanner({ onReload, onDismiss }: EngineUpdateBannerProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-b bg-accent-soft px-3 py-1.5 text-sm"
      data-testid="engine-update-banner"
    >
      <span>{strings.shell.engineUpdateMessage}</span>
      <span className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          data-testid="engine-update-reload"
          className="rounded px-2 py-0.5 text-accent-strong hover:bg-surface"
          onClick={onReload}
        >
          {strings.shell.engineUpdateReload}
        </button>
        <button
          type="button"
          data-testid="engine-update-dismiss"
          className="rounded px-2 py-0.5 text-ink-muted hover:bg-surface"
          onClick={onDismiss}
        >
          {strings.shell.engineUpdateDismiss}
        </button>
      </span>
    </div>
  );
}
