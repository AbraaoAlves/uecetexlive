import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, it, vi } from "vitest";
import { SourceEditor } from "./SourceEditor";

const TEXT = "linha um\nlinha dois\nlinha três\nlinha quatro";

function editor(props: {
  focusLine?: number;
  focusNonce?: number;
  onFocusApplied?: (line: number) => void;
}): ReactElement {
  return (
    <TooltipPrimitive.Provider>
      <SourceEditor
        path="cap.tex"
        text={TEXT}
        readOnly={false}
        onChange={() => {}}
        {...props}
      />
    </TooltipPrimitive.Provider>
  );
}

function selectedText(container: HTMLElement): string {
  return container.ownerDocument.getSelection()?.toString() ?? "";
}

it("seleciona a linha pedida em focusLine", () => {
  const { container } = render(editor({ focusLine: 3 }));
  expect(selectedText(container)).toBe("linha três");
});

it("para na última linha quando a pedida não existe", () => {
  const { container } = render(editor({ focusLine: 999 }));
  expect(selectedText(container)).toBe("linha quatro");
});

it("não avisa quando não há linha pedida", () => {
  const onFocusApplied = vi.fn();
  render(editor({ onFocusApplied }));
  expect(onFocusApplied).not.toHaveBeenCalled();
});

// Pedir a mesma linha de novo tem de valer de novo: o aluno clica "ir para" no
// mesmo item da conformidade depois de ter saído daquele ponto. Só o focusLine
// não basta — React não reexecuta o efeito quando a dependência não muda.
it("reaplica a mesma linha quando focusNonce muda", () => {
  const onFocusApplied = vi.fn();
  const { rerender } = render(editor({ focusLine: 2, focusNonce: 1, onFocusApplied }));
  expect(onFocusApplied.mock.calls).toEqual([[2]]);

  rerender(editor({ focusLine: 2, focusNonce: 2, onFocusApplied }));
  expect(onFocusApplied.mock.calls).toEqual([[2], [2]]);

  // Rerender sem mudar nada: o efeito não repete.
  rerender(editor({ focusLine: 2, focusNonce: 2, onFocusApplied }));
  expect(onFocusApplied.mock.calls).toEqual([[2], [2]]);
});
