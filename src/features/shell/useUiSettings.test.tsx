import { UiSettingsSchema } from "@papyru/project-model";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const persistence = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@/features/persistence/db", () => ({
  loadUiSettings: persistence.load,
  saveUiSettings: persistence.save,
}));

import { useUiSettings } from "./useUiSettings";

beforeEach(() => {
  persistence.load.mockReset();
  persistence.save.mockReset();
});

describe("useUiSettings", () => {
  it("reapplies an optimistic patch when loading settings fails", async () => {
    let rejectLoad: (error: Error) => void = () => {};
    persistence.load.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectLoad = reject;
      }),
    );
    persistence.save.mockResolvedValue(undefined);
    const { result } = renderHook(() => useUiSettings());

    act(() => result.current.setUi({ advancedMode: true }));
    await act(async () => rejectLoad(new Error("indisponível")));

    expect(result.current.ready).toBe(true);
    expect(result.current.ui.advancedMode).toBe(true);
    await waitFor(() => expect(persistence.save).toHaveBeenCalledOnce());
    expect(persistence.save).toHaveBeenCalledWith(
      expect.objectContaining({ advancedMode: true }),
    );
  });

  it("retries a pre-hydration patch before considering it persisted", async () => {
    let resolveLoad: (settings: unknown) => void = () => {};
    persistence.load.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );
    persistence.save
      .mockRejectedValueOnce(new Error("falha transitória"))
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useUiSettings());

    act(() => result.current.setUi({ railCollapsed: true }));
    await act(async () => resolveLoad(UiSettingsSchema.parse({})));

    await waitFor(() => expect(persistence.save).toHaveBeenCalledTimes(2));
    expect(persistence.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ railCollapsed: true }),
    );
  });

  it("serializes rapid saves so an older value cannot finish last", async () => {
    persistence.load.mockResolvedValue(UiSettingsSchema.parse({}));
    let finishFirstSave: () => void = () => {};
    persistence.save
      .mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finishFirstSave = resolve;
        }),
      )
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useUiSettings());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.setUi({ advancedMode: true });
      result.current.setUi({ railCollapsed: true });
    });
    await waitFor(() => expect(persistence.save).toHaveBeenCalledOnce());
    await act(async () => finishFirstSave());

    await waitFor(() => expect(persistence.save).toHaveBeenCalledTimes(2));
    expect(persistence.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ advancedMode: true, railCollapsed: true }),
    );
  });

  it("makes a later recovery attempt without waiting for another change", async () => {
    persistence.load.mockResolvedValue(UiSettingsSchema.parse({}));
    persistence.save
      .mockRejectedValueOnce(new Error("bloqueado"))
      .mockRejectedValueOnce(new Error("ainda bloqueado"))
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useUiSettings());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.setUi({ welcomeSeen: true }));

    await waitFor(() => expect(persistence.save).toHaveBeenCalledTimes(3), {
      timeout: 2_000,
    });
    expect(persistence.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ welcomeSeen: true }),
    );
  });
});
