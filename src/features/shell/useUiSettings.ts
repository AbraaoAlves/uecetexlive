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

const PERSIST_RETRY_DELAYS_MS = [0, 100, 750] as const;

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
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  const queuePersistence = useCallback(
    (settings: UiSettings, includedPatches: readonly Partial<UiSettings>[]) => {
      saveChainRef.current = saveChainRef.current
        .catch(() => {})
        .then(async () => {
          let saved = false;
          let lastError: unknown;
          for (const delay of PERSIST_RETRY_DELAYS_MS) {
            if (delay > 0) {
              await new Promise((resolve) => window.setTimeout(resolve, delay));
            }
            try {
              await saveUiSettings(settings);
              saved = true;
              break;
            } catch (error) {
              lastError = error;
            }
          }
          if (!saved) {
            console.error("não foi possível guardar as preferências", lastError);
            return;
          }

          const included = new Set(includedPatches);
          pendingPatchesRef.current = pendingPatchesRef.current.filter(
            (patch) => !included.has(patch),
          );
        });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    loadUiSettings()
      .then((loaded) => {
        if (cancelled) return;
        const migrated = migrateUiSettings(loaded);
        const pending = [...pendingPatchesRef.current];
        const merged: UiSettings = Object.assign({}, migrated, ...pending);
        hydratedRef.current = true;
        uiRef.current = merged;
        setUiState(merged);
        setReady(true);
        // Grava quando a migração mudou algo, ou quando havia patch em voo —
        // senão o valor legado (ou a escolha recém-feita) só sairia do disco
        // no próximo setUi.
        if (migrated !== loaded || pending.length > 0) {
          queuePersistence(merged, pending);
        }
      })
      .catch(() => {
        // IndexedDB unavailable — keep in-memory defaults for the session.
        if (cancelled) return;
        const pending = [...pendingPatchesRef.current];
        const fallback: UiSettings = Object.assign(
          {},
          UiSettingsSchema.parse({}),
          ...pending,
        );
        hydratedRef.current = true;
        uiRef.current = fallback;
        setUiState(fallback);
        setReady(true);
        if (pending.length > 0) queuePersistence(fallback, pending);
      });
    return () => {
      cancelled = true;
    };
  }, [queuePersistence]);

  const setUi = useCallback(
    (patch: Partial<UiSettings>) => {
      const next = { ...uiRef.current, ...patch };
      uiRef.current = next;
      setUiState(next);
      pendingPatchesRef.current.push(patch);
      if (!hydratedRef.current) {
        // Antes da hidratação, gravar seria escrever por cima do que ainda nem
        // foi lido — o patch espera e vai junto quando a leitura voltar.
        return;
      }
      queuePersistence(next, [...pendingPatchesRef.current]);
    },
    [queuePersistence],
  );

  return { ui, setUi, ready };
}
