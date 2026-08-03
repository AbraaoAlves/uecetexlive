import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComplianceList } from "./ComplianceList";
import type { ComplianceCheck } from "./compliance-checklist";

afterEach(cleanup);

describe("ComplianceList", () => {
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

    render(<ComplianceList checks={checks} onAction={vi.fn()} />);

    const noCaption = screen.getByTestId("compliance-item-figures-cap.tex:0");
    expect(noCaption.getAttribute("aria-label")).toContain("Sem legenda.");
    expect(screen.getByTestId("compliance-item-icon-cap.tex:0").dataset.icon).toBe(
      "image-off",
    );
    expect(noCaption.dataset.tone).toBe("warning");

    const noFonte = screen.getByTestId("compliance-item-figures-cap.tex:1");
    expect(noFonte.getAttribute("aria-label")).toContain("Sem indicação de fonte.");
    expect(screen.getByTestId("compliance-item-icon-cap.tex:1").dataset.icon).toBe(
      "help-circle",
    );
    expect(noFonte.dataset.tone).toBe("warning");

    const noBoth = screen.getByTestId("compliance-item-figures-cap.tex:2");
    expect(noBoth.getAttribute("aria-label")).toContain(
      "Sem legenda e sem indicação de fonte.",
    );
    expect(noBoth.dataset.tone).toBe("danger");
    expect(noBoth.className).toContain("text-danger");
  });

  it("explains and dispatches the review of a live import marker", () => {
    const onReviewAction = vi.fn();
    const checks: ComplianceCheck[] = [
      {
        id: "importPdf",
        status: "warn",
        count: 1,
        items: [
          {
            id: "marker",
            label: "Revisão da importação",
            reviewAction: {
              kind: "removePendencyMarker",
              path: "cap.tex",
              line: 4,
            },
          },
        ],
      },
    ];

    render(
      <ComplianceList
        checks={checks}
        onAction={vi.fn()}
        onReviewAction={onReviewAction}
      />,
    );

    expect(screen.getByTestId("compliance-marker-hint").textContent).toContain(
      "O aviso some",
    );
    fireEvent.click(screen.getByTestId("compliance-item-review-marker"));
    expect(
      screen.getByRole("button", { name: "já revisei: Revisão da importação" }),
    ).toBeTruthy();
    expect(onReviewAction).toHaveBeenCalledWith({
      kind: "removePendencyMarker",
      path: "cap.tex",
      line: 4,
    });
  });

  it("does not explain a review action that is unavailable", () => {
    const checks: ComplianceCheck[] = [
      {
        id: "importPdf",
        status: "warn",
        count: 1,
        items: [
          {
            id: "marker",
            label: "Revisão da importação",
            reviewAction: {
              kind: "removePendencyMarker",
              path: "cap.tex",
              line: 4,
            },
          },
        ],
      },
    ];

    render(<ComplianceList checks={checks} onAction={vi.fn()} />);

    expect(screen.queryByTestId("compliance-marker-hint")).toBeNull();
    expect(screen.queryByTestId("compliance-item-review-marker")).toBeNull();
  });

  it("mantém o item visitado e os atalhos de cada pendência visíveis", () => {
    const checks: ComplianceCheck[] = [
      {
        id: "figures",
        status: "warn",
        count: 1,
        action: { kind: "openFile", path: "cap.tex", line: 1 },
        items: [{ id: "cap.tex:0", label: "Figura" }],
      },
      {
        id: "abstract",
        status: "warn",
        count: 1,
        action: { kind: "openMetadata" },
      },
    ];

    render(
      <ComplianceList
        checks={checks}
        onAction={vi.fn()}
        currentItemId="cap.tex:0"
        visitedItemIds={new Set(["cap.tex:0"])}
      />,
    );

    const current = screen.getByTestId("compliance-item-figures-cap.tex:0");
    expect(current.getAttribute("aria-current")).toBe("true");
    expect(current.className).toContain("ring-2");
    expect(current.className).toContain("opacity-70");
    expect(screen.getByTestId("compliance-item-visited-figures-cap.tex:0")).toBeTruthy();
    expect(screen.getByText("Não há atalho para esta pendência.")).toBeTruthy();
    expect(screen.getByTestId("compliance-goto-abstract")).toBeTruthy();
  });
});
