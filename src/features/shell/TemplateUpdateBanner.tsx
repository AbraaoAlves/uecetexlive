/**
 * Informational-only notice: the bundled uecetex2 template moved on since
 * this project was seeded. Purely FYI — dismissing never touches files.
 */
import { strings } from "@/lib/strings";

export interface TemplateUpdateBannerProps {
  onDismiss: () => void;
}

export function TemplateUpdateBanner({ onDismiss }: TemplateUpdateBannerProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-b bg-accent-soft px-3 py-1.5 text-sm"
      data-testid="template-update-banner"
    >
      <span>{strings.shell.templateUpdateMessage}</span>
      <button
        type="button"
        data-testid="template-update-dismiss"
        className="shrink-0 rounded px-2 py-0.5 text-ink-muted hover:bg-surface"
        onClick={onDismiss}
      >
        {strings.shell.templateUpdateDismiss}
      </button>
    </div>
  );
}
