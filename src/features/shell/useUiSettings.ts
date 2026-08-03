/**
 * UI preferences (advanced toggle, rail collapse, first-run wizard flag),
 * persisted in the IndexedDB `settings` store under the "ui" key.
 * Optimistic set + fire-and-forget persist; defaults render until hydration.
 */

import {
  migrateUiSettings,
  type UiSettings,
  UiSettingsSchema,
} from "@papyru/project-model";
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

  // Quem mexe numa preferência antes de o IndexedDB responder não pode ver a
  // mudança sumir quando a resposta chega. Os patches ficam guardados e são
  // reaplicados por cima do que veio do disco.
  const hydratedRef = useRef(false);
  const pendingPatchesRef = useRef<Partial<UiSettings>[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadUiSettings()
      .then((loaded) => {
        if (cancelled) return;
        const migrated = migrateUiSettings(loaded);
        const pending = pendingPatchesRef.current;
        pendingPatchesRef.current = [];
        const merged = pending.reduce<UiSettings>(
          (acc, patch) => ({ ...acc, ...patch }),
          migrated,
        );
        hydratedRef.current = true;
        setUiState(merged);
        setReady(true);
        // Grava quando a migração mudou algo, ou quando havia patch em voo —
        // senão o valor legado (ou a escolha recém-feita) só sairia do disco
        // no próximo setUi.
        if (migrated !== loaded || pending.length > 0) {
          void saveUiSettings(merged).catch(() => {});
        }
      })
      .catch(() => {
        // IndexedDB unavailable — keep in-memory defaults for the session.
        if (cancelled) return;
        hydratedRef.current = true;
        pendingPatchesRef.current = [];
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setUi = useCallback((patch: Partial<UiSettings>) => {
    const next = { ...uiRef.current, ...patch };
    setUiState(next);
    if (!hydratedRef.current) {
      // Antes da hidratação, gravar seria escrever por cima do que ainda nem
      // foi lido — o patch espera e vai junto quando a leitura voltar.
      pendingPatchesRef.current.push(patch);
      return;
    }
    void saveUiSettings(next).catch(() => {});
  }, []);

  return { ui, setUi, ready };
}
