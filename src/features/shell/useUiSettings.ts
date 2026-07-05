/**
 * UI preferences (advanced toggle, rail collapse, first-run wizard flag),
 * persisted in the IndexedDB `settings` store under the "ui" key.
 * Optimistic set + fire-and-forget persist; defaults render until hydration.
 */

import { type UiSettings, UiSettingsSchema } from "@uecetexlive/project-model";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadUiSettings, saveUiSettings } from "@/features/persistence/db";

export interface UseUiSettings {
  ui: UiSettings;
  setUi: (patch: Partial<UiSettings>) => void;
  ready: boolean;
}

export function useUiSettings(): UseUiSettings {
  const [ui, setUiState] = useState<UiSettings>(() => UiSettingsSchema.parse({}));
  const [ready, setReady] = useState(false);
  const uiRef = useRef(ui);
  uiRef.current = ui;

  useEffect(() => {
    let cancelled = false;
    loadUiSettings()
      .then((loaded) => {
        if (cancelled) return;
        setUiState(loaded);
        setReady(true);
      })
      .catch(() => {
        // IndexedDB unavailable — keep in-memory defaults for the session.
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setUi = useCallback((patch: Partial<UiSettings>) => {
    const next = { ...uiRef.current, ...patch };
    setUiState(next);
    void saveUiSettings(next).catch(() => {});
  }, []);

  return { ui, setUi, ready };
}
