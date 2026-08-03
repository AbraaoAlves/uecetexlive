import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ComplianceCheck } from "./compliance-checklist";
import { useComplianceTour } from "./useComplianceTour";

function figures(ids: readonly string[]): ComplianceCheck[] {
  return [
    {
      id: "figures",
      status: ids.length > 0 ? "warn" : "ok",
      count: ids.length,
      items: ids.map((id) => ({ id, label: id })),
    },
  ];
}

describe("useComplianceTour", () => {
  it("visits items in order without repetition and then cycles", () => {
    const { result } = renderHook(() => useComplianceTour(figures(["a", "b", "c"])));

    act(() => expect(result.current.next("figures")?.id).toBe("a"));
    act(() => expect(result.current.next("figures")?.id).toBe("b"));
    act(() => expect(result.current.next("figures")?.id).toBe("c"));
    expect([...result.current.visited]).toEqual(["a", "b", "c"]);
    act(() => expect(result.current.next("figures")?.id).toBe("a"));
    expect(result.current.current?.id).toBe("a");
  });

  it("keeps visits across recomputes with new item objects", () => {
    const { result, rerender } = renderHook(({ checks }) => useComplianceTour(checks), {
      initialProps: { checks: figures(["a", "b", "c"]) },
    });

    act(() => expect(result.current.next("figures")?.id).toBe("a"));
    rerender({ checks: figures(["a", "b", "c"]) });
    act(() => expect(result.current.next("figures")?.id).toBe("b"));
  });

  it("marks a selected item as visited without removing it from the tour", () => {
    const { result } = renderHook(() => useComplianceTour(figures(["a", "b"])));

    act(() => result.current.visit("b"));

    expect(result.current.current?.id).toBe("b");
    expect([...result.current.visited]).toEqual(["b"]);
    act(() => expect(result.current.next("figures")?.id).toBe("a"));
  });

  it("forgets only ids that disappear and reconciles the current item", () => {
    const { result, rerender } = renderHook(({ checks }) => useComplianceTour(checks), {
      initialProps: { checks: figures(["a", "b", "c"]) },
    });

    act(() => {
      result.current.next("figures");
      result.current.next("figures");
    });
    rerender({ checks: figures(["b", "c"]) });

    expect([...result.current.visited]).toEqual(["b"]);
    expect(result.current.current?.id).toBe("b");
    act(() => expect(result.current.next("figures")?.id).toBe("c"));

    rerender({ checks: figures(["c"]) });
    expect(result.current.current?.id).toBe("c");
    expect([...result.current.visited]).toEqual(["c"]);
  });
});
