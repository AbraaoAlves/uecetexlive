import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIdleWarmup } from "../react/useIdleWarmup";
import type { PdfCompiler } from "../types";

const getCompiler = vi.fn<() => Promise<PdfCompiler>>();

const setWebdriver = (value: boolean) =>
  Object.defineProperty(window.navigator, "webdriver", { value, configurable: true });

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Covers the SW-ready timeout (8 s) plus the idle delay (2.5 s). */
const BOOT_MS = 15_000;

describe("useIdleWarmup (D12 idle prefetch)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setWebdriver(false);
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    getCompiler.mockReset();
    Reflect.deleteProperty(window.navigator, "connection");
  });

  it("skips under automation (navigator.webdriver)", async () => {
    setWebdriver(true);
    const { result } = renderHook(() => useIdleWarmup({ getCompiler }));
    expect(result.current.status).toBe("skipped");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOT_MS);
    });
    expect(getCompiler).not.toHaveBeenCalled();
  });

  it("skips when the user asked to save data", async () => {
    Object.defineProperty(window.navigator, "connection", {
      value: { saveData: true },
      configurable: true,
    });
    const { result } = renderHook(() => useIdleWarmup({ getCompiler }));
    expect(result.current.status).toBe("skipped");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOT_MS);
    });
    expect(getCompiler).not.toHaveBeenCalled();
  });

  it('localStorage "off" disables it even off-automation', async () => {
    localStorage.setItem("uecetexlive:idle-warmup", "off");
    const { result } = renderHook(() => useIdleWarmup({ getCompiler }));
    expect(result.current.status).toBe("skipped");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOT_MS);
    });
    expect(getCompiler).not.toHaveBeenCalled();
  });

  it('localStorage "force" overrides the automation guard, warming busytex-full only', async () => {
    setWebdriver(true);
    localStorage.setItem("uecetexlive:idle-warmup", "force");
    const warmup = deferred();
    getCompiler.mockResolvedValue({
      warmup: vi.fn(() => warmup.promise),
    } as never);

    renderHook(() => useIdleWarmup({ getCompiler }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOT_MS);
    });
    expect(getCompiler).toHaveBeenCalledTimes(1);
  });

  it("reports byte progress and lands on done", async () => {
    const warmup = deferred();
    const compiler = {
      warmup: vi.fn((cb?: (l: number, t: number, label: string) => void) => {
        cb?.(50, 100, "texlive-basic.data");
        return warmup.promise;
      }),
    };
    getCompiler.mockResolvedValue(compiler as never);

    const { result } = renderHook(() => useIdleWarmup({ getCompiler }));
    expect(result.current.status).toBe("idle");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOT_MS);
    });
    expect(result.current).toEqual({
      status: "running",
      loaded: 50,
      total: 100,
      label: "texlive-basic.data",
    });

    await act(async () => {
      warmup.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe("done");
  });

  it("goes quiet (skipped) when the warmup fails — compile retries anyway", async () => {
    getCompiler.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useIdleWarmup({ getCompiler }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOT_MS);
    });
    expect(result.current.status).toBe("skipped");
  });
});
