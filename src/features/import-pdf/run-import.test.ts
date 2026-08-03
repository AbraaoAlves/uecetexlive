import { afterEach, describe, expect, it, vi } from "vitest";
import { strings } from "@/lib/strings";
import { runPdfImport } from "./run-import";

class SilentWorker {
  static latest: SilentWorker | undefined;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor() {
    SilentWorker.latest = this;
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  SilentWorker.latest = undefined;
});

describe("runPdfImport", () => {
  it("encerra o worker que não envia resultado", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", SilentWorker);

    const outcome = runPdfImport(new Uint8Array([1]), new Map());
    const rejection = expect(outcome).rejects.toThrow(strings.importPdf.errorResources);
    await vi.advanceTimersByTimeAsync(120_000);

    await rejection;
    expect(SilentWorker.latest?.terminate).toHaveBeenCalledOnce();
  });

  it("encerra o worker quando uma mensagem não pode ser recebida", async () => {
    vi.stubGlobal("Worker", SilentWorker);

    const outcome = runPdfImport(new Uint8Array([1]), new Map());
    SilentWorker.latest?.onmessageerror?.(new MessageEvent("messageerror"));

    await expect(outcome).rejects.toThrow(strings.importPdf.errorResources);
    expect(SilentWorker.latest?.terminate).toHaveBeenCalledOnce();
  });
});
