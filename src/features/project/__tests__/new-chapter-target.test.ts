import { describe, expect, it } from "vitest";
import documentoTex from "../../../../public/templates/uecetex2/files/documento.tex?raw";
import { planNewSection } from "../new-chapter";

describe("planNewSection — capítulo", () => {
  const plan = planNewSection(documentoTex, "Estudo de Caso", "chapter");

  it("cria o arquivo entre os capítulos", () => {
    expect(plan.path).toBe("elementos-textuais/estudo-de-caso.tex");
    expect(plan.content).toContain("\\chapter{Estudo de Caso}");
    expect(plan.content).toContain("\\label{cap:estudo-de-caso}");
  });

  it("insere o \\input depois do último capítulo", () => {
    const anchor = "\t\\input{elementos-textuais/conclusao}\n";
    const cut = documentoTex.indexOf(anchor) + anchor.length;
    expect(plan.source).toBe(
      documentoTex.slice(0, cut) +
        "\t\\input{elementos-textuais/estudo-de-caso}\n" +
        documentoTex.slice(cut),
    );
  });

  it("capítulo não depende de nenhuma macro opcional", () => {
    expect(plan.enableMacro).toBeNull();
  });
});

describe("planNewSection — apêndice", () => {
  const plan = planNewSection(documentoTex, "Questionário Aplicado", "apendice");

  it("usa a pasta, o comando e o rótulo de apêndice", () => {
    expect(plan.path).toBe("elementos-pos-textuais/apendices/questionario-aplicado.tex");
    expect(plan.content).toContain("\\apendice{Questionário Aplicado}");
    expect(plan.content).toContain("\\label{ap:questionario-aplicado}");
  });

  it("insere o \\input no bloco dos apêndices, com a indentação do bloco", () => {
    expect(plan.source).toContain(
      "\t\t\\input{elementos-pos-textuais/apendices/termo-de-fiel-depositario}",
    );
    const inserted =
      "\t\t\\input{elementos-pos-textuais/apendices/questionario-aplicado}";
    expect(plan.source).toContain(inserted);
    // Antes do bloco de anexos.
    expect(plan.source.indexOf(inserted)).toBeLessThan(
      plan.source.indexOf("\\imprimiranexos"),
    );
  });

  it("pede que a seção de apêndices esteja ligada", () => {
    expect(plan.enableMacro).toBe("imprimirapendices");
  });
});

describe("planNewSection — anexo", () => {
  const plan = planNewSection(documentoTex, "Norma Técnica", "anexo");

  it("usa a pasta, o comando e o rótulo de anexo", () => {
    expect(plan.path).toBe("elementos-pos-textuais/anexos/norma-tecnica.tex");
    expect(plan.content).toContain("\\anexo{Norma Técnica}");
    expect(plan.content).toContain("\\label{an:norma-tecnica}");
    expect(plan.enableMacro).toBe("imprimiranexos");
  });

  it("insere depois do último anexo existente", () => {
    const anchor = "\\input{elementos-pos-textuais/anexos/dinamica-das-classes-sociais}";
    expect(plan.source.indexOf("anexos/norma-tecnica")).toBeGreaterThan(
      plan.source.indexOf(anchor),
    );
  });
});

describe("planNewSection — documento sem o bloco", () => {
  const semApendices = [
    "\\begin{document}",
    "\t\\textual",
    "\t\\input{elementos-textuais/introducao}",
    "\t\\imprimirapendices",
    "\t\\imprimiranexos",
    "\\end{document}",
    "",
  ].join("\n");

  it("insere logo abaixo da macro quando ainda não há nenhum", () => {
    const plan = planNewSection(semApendices, "Primeiro", "apendice");
    expect(plan.source).toContain(
      "\t\\imprimirapendices\n\t\t\\input{elementos-pos-textuais/apendices/primeiro}\n",
    );
  });

  it("recusa quando o documento não tem a macro — nunca inventar a seção", () => {
    const semMacro = "\\begin{document}\n\t\\textual\n\\end{document}\n";
    expect(() => planNewSection(semMacro, "Primeiro", "apendice")).toThrow(/apêndice/i);
  });
});

describe("planNewSection — nome já usado", () => {
  it("acrescenta sufixo em vez de sobrescrever", () => {
    const taken = new Set(["elementos-textuais/estudo-de-caso.tex"]);
    const plan = planNewSection(documentoTex, "Estudo de Caso", "chapter", taken);
    expect(plan.path).toBe("elementos-textuais/estudo-de-caso-2.tex");
    expect(plan.content).toContain("\\label{cap:estudo-de-caso-2}");
  });

  it("vale também para apêndices", () => {
    const taken = new Set(["elementos-pos-textuais/apendices/lorem-ipsum.tex"]);
    const plan = planNewSection(documentoTex, "Lorem Ipsum", "apendice", taken);
    expect(plan.path).toBe("elementos-pos-textuais/apendices/lorem-ipsum-2.tex");
  });

  it("título sem letras cai num nome utilizável", () => {
    expect(planNewSection(documentoTex, "!!!", "chapter").path).toBe(
      "elementos-textuais/novo-capitulo.tex",
    );
  });
});
