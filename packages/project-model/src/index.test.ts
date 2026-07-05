import { expect, it } from "vitest";
import { isWysiwygEligible, railSectionOf, UECETEX2_STRUCTURE } from "./index";

it("entry do pacote expõe o modelo com a estrutura uecetex2", () => {
  expect(isWysiwygEligible(UECETEX2_STRUCTURE, "elementos-textuais/introducao.tex")).toBe(
    true,
  );
  expect(railSectionOf(UECETEX2_STRUCTURE, "lib/uecetex2.sty")).toBe("library");
});
