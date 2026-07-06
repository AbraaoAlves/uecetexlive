/**
 * Janela curta de telemetria de uso (TCC, ~2026-07-06 a 2026-07-09) — só os
 * eventos explícitos abaixo, nunca autocapture/session replay/PII. Ver
 * MY_TCC/entregaveis/fase-5-validacao/plano-integracao-posthog.md.
 */
import posthog from "posthog-js";

const ENABLED = import.meta.env.VITE_TELEMETRY_ENABLED === "true";

export function initTelemetry() {
  if (!ENABLED) return;
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    person_profiles: "identified_only",
  });
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!ENABLED) return;
  posthog.capture(event, props);
}

export function isTelemetryEnabled() {
  return ENABLED;
}
