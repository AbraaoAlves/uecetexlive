import { describe, expect, it } from "vitest";
import abstractTex from "../../../../public/templates/uecetex2/files/elementos-pre-textuais/abstract.tex?raw";
import resumoTex from "../../../../public/templates/uecetex2/files/elementos-pre-textuais/resumo.tex?raw";
import { applyResumoField, extractResumoField } from "../resumo-field";

describe("extractResumoField (resumo.tex real do template)", () => {
  const field = extractResumoField(resumoTex, "palavraschave");

  it("captures everything before \\palavraschave{} as the body", () => {
    expect(field).not.toBeNull();
    expect(field?.body).toContain("Elemento obrigatório");
    expect(field?.body).not.toContain("\\palavraschave");
  });

  it("captures the keyword group content", () => {
    expect(field?.keywords).toBe(
      "primeira palavra-chave; segunda palavra-chave; terceira palavra-chave.",
    );
  });

  it("round-trips byte-for-byte when nothing changes", () => {
    if (!field) throw new Error("field not found");
    expect(applyResumoField(resumoTex, field, {})).toBe(resumoTex);
  });
});

describe("extractResumoField (abstract.tex real do template)", () => {
  const field = extractResumoField(abstractTex, "keywords");

  it("captures everything before \\keywords{} as the body", () => {
    expect(field).not.toBeNull();
    expect(field?.body).toContain("Mandatory element");
    expect(field?.body).not.toContain("\\keywords");
  });

  it("captures the keyword group content", () => {
    expect(field?.keywords).toBe("first keyword; second keyword; third keyword.");
  });
});

describe("applyResumoField", () => {
  const given = "Texto do resumo.\n\n\\palavraschave{a; b.}\n";
  const field = extractResumoField(given, "palavraschave");
  if (!field) throw new Error("field not found");

  it("replaces only the body, leaving the keyword macro untouched", () => {
    const result = applyResumoField(given, field, { body: "Novo resumo.\n\n" });
    expect(result).toBe("Novo resumo.\n\n\\palavraschave{a; b.}\n");
  });

  it("replaces only the keywords, leaving the body untouched", () => {
    const result = applyResumoField(given, field, { keywords: "c; d." });
    expect(result).toBe("Texto do resumo.\n\n\\palavraschave{c; d.}\n");
  });

  it("replaces both in one pass", () => {
    const result = applyResumoField(given, field, {
      body: "Outro.\n\n",
      keywords: "x.",
    });
    expect(result).toBe("Outro.\n\n\\palavraschave{x.}\n");
  });

  it("is a no-op when the values are unchanged", () => {
    const result = applyResumoField(given, field, {
      body: field.body,
      keywords: field.keywords,
    });
    expect(result).toBe(given);
  });
});

describe("extractResumoField edge cases", () => {
  it("returns null when the keyword macro is missing", () => {
    expect(
      extractResumoField("Só um texto solto, sem macro nenhuma.\n", "keywords"),
    ).toBeNull();
  });

  it("returns null on unparseable source", () => {
    expect(extractResumoField("\\begin{semfim", "palavraschave")).toBeNull();
  });
});
