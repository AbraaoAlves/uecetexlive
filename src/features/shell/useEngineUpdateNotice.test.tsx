import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEngineUpdateNotice } from "./useEngineUpdateNotice";

class FakeServiceWorkerContainer extends EventTarget {
  controller: object | null;
  constructor(controller: object | null) {
    super();
    this.controller = controller;
  }
}

function Probe() {
  const { updateAvailable } = useEngineUpdateNotice();
  return <span data-testid="probe">{updateAvailable ? "yes" : "no"}</span>;
}

/**
 * Mounts <Probe/> with `container` as navigator.serviceWorker, runs `run`,
 * then unmounts and restores the real navigator.serviceWorker — in that
 * order, so the effect's own cleanup (which reads navigator.serviceWorker)
 * still sees the mock while it runs.
 */
function withServiceWorker(
  container: FakeServiceWorkerContainer | undefined,
  run: () => void,
) {
  const hadOwn = Object.hasOwn(navigator, "serviceWorker");
  const original = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
  if (container === undefined) {
    Reflect.deleteProperty(navigator, "serviceWorker");
  } else {
    Object.defineProperty(navigator, "serviceWorker", {
      value: container,
      configurable: true,
    });
  }

  const { unmount } = render(<Probe />);
  try {
    run();
  } finally {
    act(() => {
      unmount();
    });
    if (hadOwn && original) Object.defineProperty(navigator, "serviceWorker", original);
    else Reflect.deleteProperty(navigator, "serviceWorker");
  }
}

describe("useEngineUpdateNotice", () => {
  it("stays false with no serviceWorker support at all", () => {
    withServiceWorker(undefined, () => {
      expect(screen.getByTestId("probe").textContent).toBe("no");
    });
  });

  it("stays false on a first-ever visit (no prior controller) even after a controllerchange", () => {
    const sw = new FakeServiceWorkerContainer(null);
    withServiceWorker(sw, () => {
      act(() => {
        sw.dispatchEvent(new Event("controllerchange"));
      });
      expect(screen.getByTestId("probe").textContent).toBe("no");
    });
  });

  it("flips to true when an ALREADY-controlled page sees a controllerchange", () => {
    const sw = new FakeServiceWorkerContainer({});
    withServiceWorker(sw, () => {
      expect(screen.getByTestId("probe").textContent).toBe("no");
      act(() => {
        sw.dispatchEvent(new Event("controllerchange"));
      });
      expect(screen.getByTestId("probe").textContent).toBe("yes");
    });
  });
});
