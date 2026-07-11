/**
 * 3.4 — "atualização em background com aviso discreto". src/sw.ts calls
 * skipWaiting()+clientsClaim() unconditionally, so a fresh deploy's worker
 * takes over silently the moment it activates; there is no "waiting worker"
 * moment to prompt for. The only observable signal is `controllerchange`.
 *
 * That event also fires on the very first-ever visit (uncontrolled →
 * controlled), which is not an update — only arm the listener once this
 * page has already loaded under an existing controller.
 */
import { useEffect, useState } from "react";

export function useEngineUpdateNotice(): { updateAvailable: boolean } {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (navigator.serviceWorker.controller === null) return;
    const onControllerChange = () => setUpdateAvailable(true);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return { updateAvailable };
}
