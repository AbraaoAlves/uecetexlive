import { describe, expect, it } from "vitest";
import documentoTex from "../../../../public/templates/uecetex2/files/documento.tex?raw";
import { chapterScaffold, insertChapterInput } from "../new-chapter";

describe("insertChapterInput", () => {
  it("splices after the last chapter, everything else byte-identical", () => {
    const out = insertChapterInput(documentoTex, "elementos-textuais/estudo-de-caso");
    const inserted = "\t\\input{elementos-textuais/estudo-de-caso}\n";
    const anchor = "\t\\input{elementos-textuais/conclusao}\n";
    const cut = documentoTex.indexOf(anchor) + anchor.length;
    expect(out).toBe(documentoTex.slice(0, cut) + inserted + documentoTex.slice(cut));
  });

  it("reuses the indentation of the last chapter line", () => {
    const src = "\\textual\n    \\input{elementos-textuais/introducao}\n\\end{document}";
    expect(insertChapterInput(src, "elementos-textuais/novo")).toBe(
      "\\textual\n    \\input{elementos-textuais/introducao}\n    \\input{elementos-textuais/novo}\n\\end{document}",
    );
  });

  it("ignores commented \\input lines", () => {
    const src = [
      "\\input{elementos-textuais/introducao}",
      "%\\input{elementos-textuais/rascunho}",
      "\\bibliography{referencias}",
    ].join("\n");
    expect(insertChapterInput(src, "elementos-textuais/novo")).toBe(
      [
        "\\input{elementos-textuais/introducao}",
        "\\input{elementos-textuais/novo}",
        "%\\input{elementos-textuais/rascunho}",
        "\\bibliography{referencias}",
      ].join("\n"),
    );
  });

  it("does not anchor on appendix/annex inputs", () => {
    const out = insertChapterInput(documentoTex, "elementos-textuais/novo");
    const idx = out.indexOf("\\input{elementos-textuais/novo}");
    expect(idx).toBeGreaterThan(-1);
    expect(idx).toBeLessThan(out.indexOf("\\imprimirapendices"));
  });

  it("throws when no chapter \\input exists", () => {
    expect(() => insertChapterInput("\\begin{document}\\end{document}", "x")).toThrow(
      /Nenhum capítulo/,
    );
  });
});

describe("chapterScaffold", () => {
  it("builds \\chapter + \\label from title and slug", () => {
    expect(chapterScaffold("Estudo de Caso", "estudo-de-caso")).toBe(
      "\\chapter{Estudo de Caso}\n\\label{cap:estudo-de-caso}\n\n",
    );
  });
});
