import { describe, expect, it } from "vitest";
import { applySignedApproval, SIGNED_APPROVAL_PATH } from "../signed-approval";

const source = String.raw`\documentclass{article}
\begin{document}
	\imprimirfichacatalografica{elementos-pre-textuais/ficha-catalografica}
	\imprimirfolhadeaprovacao
\end{document}`;

describe("applySignedApproval", () => {
  it("substitui a folha gerada pelo PDF assinado", () => {
    const result = applySignedApproval(source, true);
    expect(result).toContain(`\\includepdf[pages=-]{${SIGNED_APPROVAL_PATH}}`);
    expect(result).not.toContain("\\imprimirfolhadeaprovacao");
  });

  it("restaura a folha gerada ao remover o PDF", () => {
    const signed = applySignedApproval(source, true);
    expect(applySignedApproval(signed, false)).toBe(source);
  });

  it("é idempotente e não inventa uma linha em projetos incompatíveis", () => {
    const signed = applySignedApproval(source, true);
    expect(applySignedApproval(signed, true)).toBe(signed);
    const minimal = String.raw`\begin{document}Texto\end{document}`;
    expect(applySignedApproval(minimal, true)).toBe(minimal);
  });
});
