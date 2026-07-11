/**
 * navigator.storage.persist() (3.5) — best-effort request that the browser
 * not evict IndexedDB under storage pressure. Same fire-and-forget,
 * unsupported-is-fine idiom as useUiSettings.setUi's saveUiSettings call:
 * nothing in the app depends on this succeeding, it only reduces the odds
 * of silent data loss.
 */
import { useEffect } from "react";

export function useStoragePersistence(): void {
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return;
    void navigator.storage.persist().catch(() => {});
  }, []);
}
