import { describe, expect, it } from "vitest";
import abstractTex from "../../../../public/templates/uecetex2/files/elementos-pre-textuais/abstract.tex?raw";
import resumoTex from "../../../../public/templates/uecetex2/files/elementos-pre-textuais/resumo.tex?raw";
import {
  applyResumoField,
  extractResumoField,
  normalizeResumoSource,
} from "../resumo-field";

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

describe("normalizeResumoSource", () => {
  it("devolve null quando a macro já existe", () => {
    expect(normalizeResumoSource(resumoTex, "palavraschave")).toBeNull();
    expect(normalizeResumoSource(abstractTex, "keywords")).toBeNull();
  });

  it("converte o rótulo colado no fim do parágrafo único", () => {
    const source =
      "Este estudo comparou plataformas de correção. " +
      "Palavras-chave: ensino; correção; sobrecarga.\n";
    const normalized = normalizeResumoSource(source, "palavraschave");
    expect(normalized).toBe(
      "Este estudo comparou plataformas de correção.\n\n" +
        "\\palavraschave{ensino; correção; sobrecarga.}\n",
    );
  });

  it("converte o rótulo escrito como parágrafo próprio", () => {
    const source = "Corpo do resumo.\n\nPalavras-chave: um; dois.\n";
    expect(normalizeResumoSource(source, "palavraschave")).toBe(
      "Corpo do resumo.\n\n\\palavraschave{um; dois.}\n",
    );
  });

  it("usa a macro do parâmetro mesmo com o rótulo na outra língua", () => {
    const source = "Abstract body.\n\nKeywords: one; two.\n";
    expect(normalizeResumoSource(source, "keywords")).toBe(
      "Abstract body.\n\n\\keywords{one; two.}\n",
    );
    // Arquivo de abstract que veio com o rótulo em português.
    const trocado = "Abstract body.\n\nPalavras-chave: one; two.\n";
    expect(normalizeResumoSource(trocado, "keywords")).toContain("\\keywords{one; two.}");
  });

  it("usa a última ocorrência — o corpo pode citar a expressão", () => {
    const source =
      "Finalize com as palavras-chave, antecedidas de Palavras-chave:, em minúsculas. " +
      "Palavras-chave: real; valendo.\n";
    const normalized = normalizeResumoSource(source, "palavraschave") ?? "";
    expect(normalized).toContain("\\palavraschave{real; valendo.}");
    expect(normalized).toContain("antecedidas de Palavras-chave:, em minúsculas.");
  });

  it("devolve null quando não há rótulo nenhum", () => {
    expect(normalizeResumoSource("Só o corpo do resumo.\n", "palavraschave")).toBeNull();
  });

  it("aceita chaves pareadas nas palavras-chave", () => {
    const source = "Corpo. Palavras-chave: \\LaTeX{}; escrita.\n";
    expect(normalizeResumoSource(source, "palavraschave")).toContain(
      "\\palavraschave{\\LaTeX{}; escrita.}",
    );
  });

  it("recusa chave desbalanceada em vez de estragar o documento", () => {
    const source = "Corpo. Palavras-chave: quebrado}; solto.\n";
    expect(normalizeResumoSource(source, "palavraschave")).toBeNull();
  });

  it("é idempotente", () => {
    const once = normalizeResumoSource("Corpo. Palavras-chave: a; b.\n", "palavraschave");
    expect(once).not.toBeNull();
    expect(normalizeResumoSource(once ?? "", "palavraschave")).toBeNull();
  });

  it("o resultado é lido de volta por extractResumoField", () => {
    const normalized =
      normalizeResumoSource(
        "Corpo do resumo. Palavras-chave: a; b.\n",
        "palavraschave",
      ) ?? "";
    const field = extractResumoField(normalized, "palavraschave");
    expect(field?.keywords).toBe("a; b.");
    expect(field?.body.trim()).toBe("Corpo do resumo.");
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
