import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStoragePersistence } from "./useStoragePersistence";

function Probe() {
  useStoragePersistence();
  return null;
}

describe("useStoragePersistence", () => {
  it("calls navigator.storage.persist() once when supported", () => {
    const persist = vi.fn().mockResolvedValue(true);
    const original = Object.getOwnPropertyDescriptor(navigator, "storage");
    Object.defineProperty(navigator, "storage", {
      value: { persist },
      configurable: true,
    });
    try {
      render(<Probe />);
      expect(persist).toHaveBeenCalledTimes(1);
    } finally {
      if (original) Object.defineProperty(navigator, "storage", original);
      else Reflect.deleteProperty(navigator, "storage");
    }
  });

  it("does nothing (and doesn't throw) when navigator.storage is absent", () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "storage");
    Reflect.deleteProperty(navigator, "storage");
    try {
      expect(() => render(<Probe />)).not.toThrow();
    } finally {
      if (original) Object.defineProperty(navigator, "storage", original);
      else Reflect.deleteProperty(navigator, "storage");
    }
  });

  it("swallows a rejection instead of throwing an unhandled rejection", async () => {
    const persist = vi.fn().mockRejectedValue(new Error("denied"));
    const original = Object.getOwnPropertyDescriptor(navigator, "storage");
    Object.defineProperty(navigator, "storage", {
      value: { persist },
      configurable: true,
    });
    try {
      render(<Probe />);
      await Promise.resolve();
      await Promise.resolve();
    } finally {
      if (original) Object.defineProperty(navigator, "storage", original);
      else Reflect.deleteProperty(navigator, "storage");
    }
  });
});
