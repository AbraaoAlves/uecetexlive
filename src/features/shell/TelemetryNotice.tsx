/**
 * Disclosure da janela curta de telemetria (TCC, ver
 * MY_TCC/entregaveis/fase-5-validacao/plano-integracao-posthog.md). Só
 * renderiza quando a telemetria está de fato ligada (build da janela de
 * coleta); dispensável, sem persistência entre sessões.
 */
import { strings } from "@/lib/strings";

// TODO(abraao): trocar pelo link real do Google Forms antes de publicar.
const FEEDBACK_FORM_URL = "https://forms.gle/SEU_FORMULARIO_AQUI";

export interface TelemetryNoticeProps {
  onDismiss: () => void;
}

export function TelemetryNotice({ onDismiss }: TelemetryNoticeProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-4 border-t bg-accent-soft px-3 py-1.5 text-sm"
      data-testid="telemetry-notice"
    >
      <span>
        {strings.shell.telemetryNoticeMessage}{" "}
        <a
          href={FEEDBACK_FORM_URL}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          {strings.shell.telemetryNoticeLink}
        </a>
      </span>
      <button
        type="button"
        data-testid="telemetry-notice-dismiss"
        aria-label={strings.shell.telemetryNoticeDismiss}
        className="shrink-0 rounded px-2 py-0.5 text-ink-muted hover:bg-surface"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
