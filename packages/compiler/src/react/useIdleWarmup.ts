/**
 * Kicks the one-time busytex (Completa) engine warmup while the student is
 * still looking around (D12): the first Compilar completo then finds engine +
 * TeX trees already cached instead of paying the ~150 MB download at click
 * time. SwiftLaTeX (Rascunho) is a separate, much smaller engine that fetches
 * its own assets on demand — it isn't warmed here.
 *
 * Skips under automation (`navigator.webdriver` — a warmup per page would
 * sink the e2e machine) and when the user asked to save data. localStorage
 * "uecetexlive:idle-warmup" = "force" | "off" overrides both.
 */
import { useEffect, useRef, useState } from "react";
import type { PdfCompiler } from "../types";

export interface IdleWarmupOptions {
  /** Obtém o compiler a aquecer — o app faz o bind de engine + assetBaseUrl. */
  getCompiler: () => Promise<PdfCompiler>;
  /** Chave do override localStorage ("force" | "off"). */
  storageKey?: string;
}

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

function shouldSkip(storageKey: string): boolean {
  try {
    const override = localStorage.getItem(storageKey);
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

export function useIdleWarmup({
  getCompiler,
  storageKey = "uecetexlive:idle-warmup",
}: IdleWarmupOptions): IdleWarmupState {
  const [state, setState] = useState<IdleWarmupState>(initial);
  // Capturado no mount: o warmup é one-shot; identidades novas do getter
  // não devem reiniciá-lo.
  const getCompilerRef = useRef(getCompiler);
  getCompilerRef.current = getCompiler;

  useEffect(() => {
    if (shouldSkip(storageKey)) {
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

      const compiler = await getCompilerRef.current();
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
  }, [storageKey]);

  return state;
}
