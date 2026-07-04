import { describe, expect, it } from "vitest";
import documentoTex from "../../../../public/templates/uecetex2/files/documento.tex?raw";
import {
  applyMetadata,
  escapeMetadataValue,
  extractMetadata,
  METADATA_MACROS,
  workTypeOf,
} from "../metadata";

describe("extractMetadata (documento.tex real do template)", () => {
  const fields = extractMetadata(documentoTex);

  it("extracts the headline fields with exact values", () => {
    expect(fields.get("titulo")?.value).toBe("Título do Trabalho");
    expect(fields.get("autor")?.value).toBe("Nome Sobrenome");
    expect(fields.get("data")?.value).toBe("2017");
    expect(fields.get("local")?.value).toBe("Fortaleza -- Ceará");
    expect(fields.get("orientador")?.value).toBe("Nome do seu Orientador");
  });

  it("ignores commented \\trabalhoacademico lines (L32-35)", () => {
    expect(fields.get("trabalhoacademico")?.value).toBe("dissertacao");
    expect(workTypeOf(fields)).toBe("dissertacao");
  });

  it("handles a trailing comment on the same line (habilitacao)", () => {
    expect(fields.get("habilitacao")?.value).toBe("bacharel");
  });

  it("captures empty groups (start === end)", () => {
    for (const macro of ["coorientador", "dataaprovacao", "membrodabancaseiscentro"]) {
      const f = fields.get(macro);
      expect(f, macro).toBeDefined();
      expect(f?.value).toBe("");
      expect(f?.start).toBe(f?.end);
    }
  });

  it("finds every catalog macro present in the template preamble", () => {
    // The template calls every macro in the catalog at least once.
    for (const macro of METADATA_MACROS) {
      expect(fields.has(macro), macro).toBe(true);
    }
  });

  it("offsets slice back to the exact value", () => {
    for (const f of fields.values()) {
      expect(documentoTex.slice(f.start, f.end)).toBe(f.value);
    }
  });

  it("ignores occurrences after \\begin{document}", () => {
    const src = "\\titulo{A}\n\\begin{document}\n\\titulo{B}\n\\end{document}\n";
    expect(extractMetadata(src).get("titulo")?.value).toBe("A");
  });

  it("last non-commented occurrence wins (\\def semantics)", () => {
    const src =
      "%\\titulo{X}\n\\titulo{A}\n\\titulo{B}\n\\begin{document}\\end{document}";
    expect(extractMetadata(src).get("titulo")?.value).toBe("B");
  });

  it("keeps nested braces in the value", () => {
    const src = "\\titulo{Uso de {X} em {Y}}\n";
    expect(extractMetadata(src).get("titulo")?.value).toBe("Uso de {X} em {Y}");
  });

  it("skips the optional [label] arg of \\orientador", () => {
    const src = "\\orientador[Orientadora]{Maria da Silva}\n";
    expect(extractMetadata(src).get("orientador")?.value).toBe("Maria da Silva");
  });
});

describe("applyMetadata", () => {
  it("round-trip identity: re-applying extracted values is byte-exact", () => {
    const fields = extractMetadata(documentoTex);
    const updates = new Map<string, string>();
    for (const [macro, f] of fields) updates.set(macro, f.value);
    expect(applyMetadata(documentoTex, updates)).toBe(documentoTex);
  });

  it("changes only the bytes of the updated group", () => {
    const field = extractMetadata(documentoTex).get("titulo");
    if (!field) throw new Error("titulo not found");
    const result = applyMetadata(documentoTex, new Map([["titulo", "Meu TCC"]]));
    expect(result.slice(0, field.start)).toBe(documentoTex.slice(0, field.start));
    expect(result.slice(field.start, field.start + "Meu TCC".length)).toBe("Meu TCC");
    expect(result.slice(field.start + "Meu TCC".length)).toBe(
      documentoTex.slice(field.end),
    );
  });

  it("swapping the work type leaves the commented variants intact", () => {
    const result = applyMetadata(
      documentoTex,
      new Map([["trabalhoacademico", "tccgraduacao"]]),
    );
    expect(result).toContain("%\\trabalhoacademico{tccgraduacao}");
    expect(result).toContain("%\\trabalhoacademico{tese}");
    expect(result).toContain("\n\\trabalhoacademico{tccgraduacao}");
    expect(result).not.toContain("\n\\trabalhoacademico{dissertacao}");
  });

  it("applies multiple updates in one call (banca inteira)", () => {
    const updates = new Map([
      ["membrodabancadois", "Profa. Dra. Ana"],
      ["membrodabancatres", "Prof. Dr. Beto"],
      ["membrodabancaseiscentro", "CCT"],
      ["titulo", "Título Novo"],
    ]);
    const result = applyMetadata(documentoTex, updates);
    expect(result).toContain("\\membrodabancadois{Profa. Dra. Ana}");
    expect(result).toContain("\\membrodabancatres{Prof. Dr. Beto}");
    expect(result).toContain("\\membrodabancaseiscentro{CCT}");
    expect(result).toContain("\\titulo{Título Novo}");
    // Untouched neighbours stay as-is.
    expect(result).toContain("\\membrodabancaquatro{Membro da Banca Quatro}");
  });

  it("fills an empty group", () => {
    const result = applyMetadata(
      documentoTex,
      new Map([["dataaprovacao", "01 de Julho de 2026"]]),
    );
    expect(result).toContain("\\dataaprovacao{01 de Julho de 2026}");
  });

  it("skips macros absent from the source (graceful degradation)", () => {
    const src = "\\titulo{A}\n\\begin{document}\\end{document}";
    expect(applyMetadata(src, new Map([["autor", "Fulano"]]))).toBe(src);
  });

  it("preserves the optional [label] arg while replacing the value", () => {
    const src = "\\orientador[Orientadora]{Maria}\n";
    expect(applyMetadata(src, new Map([["orientador", "Ana"]]))).toBe(
      "\\orientador[Orientadora]{Ana}\n",
    );
  });
});

describe("escapeMetadataValue", () => {
  it("escapes LaTeX special characters in one pass", () => {
    expect(escapeMetadataValue("50% & R$ #1_a")).toBe("50\\% \\& R\\$ \\#1\\_a");
    expect(escapeMetadataValue("{x}")).toBe("\\{x\\}");
    expect(escapeMetadataValue("a~b^c")).toBe("a\\textasciitilde{}b\\textasciicircum{}c");
    expect(escapeMetadataValue("a\\b")).toBe("a\\textbackslash{}b");
  });

  it("leaves plain pt-BR text untouched", () => {
    expect(escapeMetadataValue("Análise de Sistemas — Educação")).toBe(
      "Análise de Sistemas — Educação",
    );
  });
});
