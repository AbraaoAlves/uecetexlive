import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComplianceChecklist } from "./ComplianceChecklist";
import type { ComplianceCheck } from "./compliance-checklist";

afterEach(cleanup);

describe("ComplianceChecklist", () => {
  it("distinguishes every figure reason by icon, tone and accessible text", () => {
    const checks: ComplianceCheck[] = [
      {
        id: "figures",
        status: "warn",
        count: 3,
        items: [
          {
            id: "cap.tex:0",
            label: "Sem legenda",
            detail: "Sem legenda.",
            reason: "sem-legenda",
          },
          {
            id: "cap.tex:1",
            label: "Sem fonte",
            detail: "Sem indicação de fonte.",
            reason: "sem-fonte",
          },
          {
            id: "cap.tex:2",
            label: "Sem os dois",
            detail: "Sem legenda e sem indicação de fonte.",
            reason: "sem-legenda-e-fonte",
          },
        ],
      },
    ];

    render(<ComplianceChecklist checks={checks} onAction={vi.fn()} onClose={vi.fn()} />);

    const noCaption = screen.getByTestId("compliance-item-cap.tex:0");
    expect(noCaption.getAttribute("aria-label")).toContain("Sem legenda.");
    expect(screen.getByTestId("compliance-item-icon-cap.tex:0").dataset.icon).toBe(
      "image-off",
    );
    expect(noCaption.dataset.tone).toBe("warning");

    const noFonte = screen.getByTestId("compliance-item-cap.tex:1");
    expect(noFonte.getAttribute("aria-label")).toContain("Sem indicação de fonte.");
    expect(screen.getByTestId("compliance-item-icon-cap.tex:1").dataset.icon).toBe(
      "help-circle",
    );
    expect(noFonte.dataset.tone).toBe("warning");

    const noBoth = screen.getByTestId("compliance-item-cap.tex:2");
    expect(noBoth.getAttribute("aria-label")).toContain(
      "Sem legenda e sem indicação de fonte.",
    );
    expect(noBoth.dataset.tone).toBe("danger");
    expect(noBoth.className).toContain("text-danger");
  });
});
