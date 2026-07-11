/**
 * 3.4 — "atualização em background com aviso discreto". src/sw.ts calls
 * skipWaiting()+clientsClaim() unconditionally, so a fresh deploy's worker
 * takes over silently the moment it activates; there is no "waiting worker"
 * moment to prompt for. The only observable signal is `controllerchange`.
 *
 * That event also fires on the very first-ever visit (uncontrolled →
 * controlled), which is not an update. The listener must still be armed
 * unconditionally at mount — a page can go from uncontrolled to controlled
 * moments after mount (first-ever activation is async), and a real update
 * can land later in that same session; skipping attachment whenever
 * `controller` happens to be null at mount would miss that. Instead, the
 * first transition the listener itself observes is always ignored — only
 * subsequent ones count as a real update.
 */
import { useEffect, useState } from "react";

export function useEngineUpdateNotice(): { updateAvailable: boolean } {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    let sawFirstTransition = sw.controller !== null;
    const onControllerChange = () => {
      if (!sawFirstTransition) {
        sawFirstTransition = true;
        return;
      }
      setUpdateAvailable(true);
    };
    sw.addEventListener("controllerchange", onControllerChange);
    return () => sw.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return { updateAvailable };
}
