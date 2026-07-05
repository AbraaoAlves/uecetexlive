/**
 * Kicks the one-time engine warmup while the student is still looking around
 * (D12): the first Compilar then finds engine + TeX trees already cached
 * instead of paying the ~155 MB download at click time.
 *
 * Skips under automation (`navigator.webdriver` — a warmup per page would
 * sink the e2e machine) and when the user asked to save data. localStorage
 * "uecetexlive:idle-warmup" = "force" | "off" overrides both.
 */
import { useEffect, useState } from "react";
import { getCompiler } from "./index";

export interface IdleWarmupState {
  status: "idle" | "running" | "done" | "skipped";
  loaded: number;
  total: number;
  label: string;
}

/** Give the shell a breath before saturating the connection. */
const IDLE_DELAY_MS = 2500;
/** How long to wait for the service worker before downloading anyway. */
const SW_READY_TIMEOUT_MS = 8000;

function shouldSkip(): boolean {
  try {
    const override = localStorage.getItem("uecetexlive:idle-warmup");
    if (override === "force") return false;
    if (override === "off") return true;
  } catch {
    // storage unavailable → fall through to the defaults
  }
  if (navigator.webdriver) return true;
  const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

const initial: IdleWarmupState = { status: "idle", loaded: 0, total: 0, label: "" };

export function useIdleWarmup(): IdleWarmupState {
  const [state, setState] = useState<IdleWarmupState>(initial);

  useEffect(() => {
    if (shouldSkip()) {
      setState((prev) => ({ ...prev, status: "skipped" }));
      return;
    }
    let cancelled = false;

    const run = async () => {
      // Let the SW take control first: the download then flows through the
      // gzip-sidecar route (src/sw.ts) and lands in the offline cache.
      await Promise.race([
        navigator.serviceWorker?.ready ?? Promise.resolve(),
        new Promise((resolve) => setTimeout(resolve, SW_READY_TIMEOUT_MS)),
      ]);
      await new Promise((resolve) => setTimeout(resolve, IDLE_DELAY_MS));
      if (cancelled) return;

      const compiler = await getCompiler();
      await compiler.warmup((loaded, total, label) => {
        if (!cancelled) setState({ status: "running", loaded, total, label });
      });
      if (!cancelled) setState((prev) => ({ ...prev, status: "done" }));
    };

    run().catch(() => {
      // Stay silent: the compile button retries warmup and reports there.
      if (!cancelled) setState((prev) => ({ ...prev, status: "skipped" }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
