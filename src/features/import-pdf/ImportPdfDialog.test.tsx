import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportPdfDialog } from "./ImportPdfDialog";

afterEach(cleanup);

describe("ImportPdfDialog", () => {
  it("labels the error action according to the callback it will run", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ImportPdfDialog
        state={{ kind: "error", message: "Falhou" }}
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledOnce();

    const onRetry = vi.fn();
    rerender(
      <ImportPdfDialog
        state={{ kind: "error", message: "Falhou" }}
        onConfirm={vi.fn()}
        onClose={onClose}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Escolher outro arquivo" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps Tab navigation inside the modal actions", () => {
    render(
      <ImportPdfDialog
        state={{
          kind: "report",
          report: {
            chapters: 0,
            figures: 0,
            tables: 0,
            listItems: 0,
            codeBlocks: 0,
            bibEntries: 0,
            citations: { linked: 0, literal: 0 },
            pretextuais: [],
            pendencias: [],
          },
          fileCount: 0,
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const cancel = screen.getByRole("button", { name: "Cancelar" });
    const confirm = screen.getByRole("button", { name: "Criar projeto" });

    cancel.focus();
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);

    confirm.focus();
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);
  });
});
