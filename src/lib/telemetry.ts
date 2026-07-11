/**
 * Janela curta de telemetria de uso (TCC, 2026-07-11 a 2026-07-13) — só os
 * eventos explícitos abaixo, nunca autocapture/session replay/PII. Ver
 * MY_TCC/entregaveis/fase-5-validacao/plano-integracao-posthog.md.
 */
import posthog from "posthog-js";

const ENABLED = import.meta.env.VITE_TELEMETRY_ENABLED === "true";

/**
 * e2e e scripts Playwright rodam contra builds com a mesma chave do .env —
 * sem este guard, cada spec emite um `app_loaded` real dentro da janela de
 * coleta. (Runs antigas ficam filtráveis no PostHog por $host=localhost.)
 */
function collecting() {
  return ENABLED && !navigator.webdriver;
}

export function initTelemetry() {
  if (!collecting()) return;
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    person_profiles: "identified_only",
  });
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!collecting()) return;
  posthog.capture(event, props);
}

export function isTelemetryEnabled() {
  return ENABLED;
}
