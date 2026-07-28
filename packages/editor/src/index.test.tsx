import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it } from "vitest";
import { EditorStringsProvider, useEditorStrings } from "./index";

it("copy padrão é a PT-BR original", () => {
  const { result } = renderHook(() => useEditorStrings());
  expect(result.current.toolbar.bold).toBe("Negrito");
  expect(result.current.preview.empty).toBe("Compile para ver o PDF aqui.");
});

it("consumidor sobrescreve chaves via EditorStringsProvider", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <EditorStringsProvider strings={{ toolbar: { bold: "Bold!" } }}>
      {children}
    </EditorStringsProvider>
  );
  const { result } = renderHook(() => useEditorStrings(), { wrapper });
  expect(result.current.toolbar.bold).toBe("Bold!");
  // Chaves não sobrescritas caem no default.
  expect(result.current.toolbar.italic).toBe("Itálico");
});
