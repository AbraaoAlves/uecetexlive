import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComplianceRail } from "./ComplianceRail";
import type { ComplianceCheck } from "./compliance-checklist";

afterEach(cleanup);

describe("ComplianceRail", () => {
  it("resume quando não há pendências e deixa os itens aprovados sob demanda", () => {
    const checks: ComplianceCheck[] = [
      { id: "pretextual", status: "ok", count: 0 },
      { id: "abstract", status: "ok", count: 0 },
    ];

    render(<ComplianceRail checks={checks} onAction={vi.fn()} />);

    expect(screen.getByTestId("compliance-rail-summary").textContent).toContain(
      "Tudo certo",
    );
    expect(screen.queryByTestId("compliance-check-pretextual")).toBeNull();

    fireEvent.click(screen.getByTestId("compliance-show-ok"));
    expect(
      screen.getByTestId("compliance-check-pretextual").getAttribute("data-status"),
    ).toBe("ok");
  });

  it("expõe os poucos itens e leva ao destino selecionado", () => {
    const onAction = vi.fn();
    const checks: ComplianceCheck[] = [
      {
        id: "references",
        status: "warn",
        count: 1,
        items: [
          {
            id: "silva2026",
            label: "Silva 2026",
            detail: "Faltam: título.",
            action: { kind: "openReferences", key: "silva2026", intent: "focus" },
          },
        ],
      },
    ];

    render(<ComplianceRail checks={checks} onAction={onAction} />);

    const expand = screen.getByTestId("compliance-expand-references");
    expect(expand.getAttribute("aria-expanded")).toBe("true");
    expect(expand.getAttribute("aria-controls")).toBe("compliance-items-references");
    expect(screen.getByTestId("compliance-item-references-silva2026")).toBeTruthy();
    expect(screen.getByTitle("Faltam: título.")).toBeTruthy();

    fireEvent.click(screen.getByTestId("compliance-goto-references-silva2026"));
    expect(onAction).toHaveBeenCalledWith({
      kind: "openReferences",
      key: "silva2026",
      intent: "focus",
    });

    fireEvent.click(expand);
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("compliance-item-references-silva2026")).toBeNull();
  });

  it("oferece a próxima correção enquanto há pendências", () => {
    const onNext = vi.fn();
    const checks: ComplianceCheck[] = [
      {
        id: "pretextual",
        status: "warn",
        count: 1,
        action: { kind: "openMetadata" },
      },
    ];

    render(<ComplianceRail checks={checks} onAction={vi.fn()} onNext={onNext} />);

    fireEvent.click(screen.getByTestId("compliance-next-all"));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("mantém grupos longos recolhidos e explica quando não há destino", () => {
    const checks: ComplianceCheck[] = [
      {
        id: "importPdf",
        status: "warn",
        count: 4,
        items: ["a", "b", "c", "d"].map((id) => ({
          id,
          label: `Pendência ${id}`,
          detail: "Consulte o PDF original.",
        })),
      },
    ];

    render(<ComplianceRail checks={checks} onAction={vi.fn()} />);

    const expand = screen.getByTestId("compliance-expand-importPdf");
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("compliance-item-importPdf-a")).toBeNull();

    fireEvent.click(expand);
    expect(screen.getByTestId("compliance-item-importPdf-a")).toBeTruthy();
    expect(screen.getAllByText("Não há atalho para esta pendência.")).toHaveLength(4);
  });
});
