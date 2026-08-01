import { describe, expect, it } from "vitest";
import documentoTex from "../../../../public/templates/uecetex2/files/documento.tex?raw";
import {
  applyImprimirToggle,
  extractImprimirToggles,
  TOGGLE_FILES,
  TOGGLE_LISTS,
} from "../imprimir-toggles";

/** Documento mínimo: só o corpo importa para os toggles. */
function doc(body: string, preamble = ""): string {
  return `${preamble}\\begin{document}\n${body}\n\\end{document}\n`;
}

describe("extractImprimirToggles", () => {
  it("lê a linha ativa com indentação de tabulação", () => {
    const toggles = extractImprimirToggles(
      doc("\t\\imprimiragradecimentos{elementos-pre-textuais/agradecimentos}"),
    );
    const agradecimentos = toggles.get("imprimiragradecimentos");
    expect(agradecimentos?.enabled).toBe(true);
    expect(agradecimentos?.argument).toBe("elementos-pre-textuais/agradecimentos");
  });

  it("lê a linha comentada sem espaço após o %", () => {
    const toggles = extractImprimirToggles(
      doc("\t%\\imprimirdedicatoria{elementos-pre-textuais/dedicatoria}"),
    );
    expect(toggles.get("imprimirdedicatoria")?.enabled).toBe(false);
  });

  it("lê a linha comentada com espaço após o %", () => {
    const toggles = extractImprimirToggles(
      doc("\t% \\imprimirerrata{elementos-pre-textuais/errata}"),
    );
    expect(toggles.get("imprimirerrata")?.enabled).toBe(false);
  });

  it("lê a macro sem argumento", () => {
    const toggles = extractImprimirToggles(doc("\t\\imprimirlistadetabelas"));
    expect(toggles.get("imprimirlistadetabelas")?.argument).toBeNull();
    expect(toggles.get("imprimirlistadetabelas")?.enabled).toBe(true);
  });

  it("ignora a linha com comentário à direita (limitação aceita)", () => {
    const toggles = extractImprimirToggles(doc("\t\\imprimirresumo{x} % observação"));
    expect(toggles.has("imprimirresumo")).toBe(false);
  });

  it("ignora macro fora de \\begin{document}", () => {
    const toggles = extractImprimirToggles(
      doc("\t\\imprimirsumario", "% exemplo: \\imprimirglossario{x}\n"),
    );
    expect(toggles.has("imprimirglossario")).toBe(false);
    expect(toggles.has("imprimirsumario")).toBe(true);
  });

  it("na duplicata, a última ocorrência vence", () => {
    const source = doc("\t\\imprimirepigrafe{a}\n\t%\\imprimirepigrafe{b}");
    expect(extractImprimirToggles(source).get("imprimirepigrafe")?.enabled).toBe(false);
  });

  it("devolve um mapa vazio para um documento sem corpo", () => {
    expect(extractImprimirToggles("\\documentclass{article}\n").size).toBe(0);
  });
});

describe("applyImprimirToggle", () => {
  const source = doc(
    [
      "\t\\imprimiragradecimentos{elementos-pre-textuais/agradecimentos}",
      "\t%\\imprimirdedicatoria{elementos-pre-textuais/dedicatoria}",
    ].join("\n"),
  );

  it("desliga comentando a linha e preservando a indentação", () => {
    const off = applyImprimirToggle(source, "imprimiragradecimentos", false);
    expect(off).toContain("\t%\\imprimiragradecimentos{");
    expect(off.length).toBe(source.length + 1);
  });

  it("liga removendo o comentário", () => {
    const on = applyImprimirToggle(source, "imprimirdedicatoria", true);
    expect(on).toContain("\t\\imprimirdedicatoria{");
    expect(on).not.toContain("%\\imprimirdedicatoria");
  });

  it("desligar e religar reproduz o documento byte a byte", () => {
    const off = applyImprimirToggle(source, "imprimiragradecimentos", false);
    expect(applyImprimirToggle(off, "imprimiragradecimentos", true)).toBe(source);
  });

  it("é no-op quando a macro já está no estado pedido", () => {
    expect(applyImprimirToggle(source, "imprimiragradecimentos", true)).toBe(source);
    expect(applyImprimirToggle(source, "imprimirdedicatoria", false)).toBe(source);
  });

  it("é no-op quando a macro não existe — nunca inventar a linha", () => {
    expect(applyImprimirToggle(source, "imprimirglossario", true)).toBe(source);
  });

  it("age na última ocorrência quando há duplicata", () => {
    const duplicado = doc("\t\\imprimirepigrafe{a}\n\t\\imprimirepigrafe{b}");
    const off = applyImprimirToggle(duplicado, "imprimirepigrafe", false);
    expect(off).toContain("\t\\imprimirepigrafe{a}");
    expect(off).toContain("\t%\\imprimirepigrafe{b}");
  });

  it("o estado extraído reflete o que foi aplicado", () => {
    for (const enabled of [false, true]) {
      const next = applyImprimirToggle(source, "imprimiragradecimentos", enabled);
      expect(extractImprimirToggles(next).get("imprimiragradecimentos")?.enabled).toBe(
        enabled,
      );
    }
  });

  it("remove o comentário mesmo com espaço depois do %", () => {
    const comEspaco = doc("\t% \\imprimirerrata{x}");
    const on = applyImprimirToggle(comEspaco, "imprimirerrata", true);
    expect(on).toContain("\t\\imprimirerrata{x}");
  });
});

describe("sentinela do modelo vendorado", () => {
  const toggles = extractImprimirToggles(documentoTex);

  it("todas as macros com arquivo próprio existem no modelo", () => {
    for (const macro of TOGGLE_FILES.keys()) {
      expect(toggles.has(macro)).toBe(true);
    }
  });

  it("todas as listas automáticas existem no modelo", () => {
    for (const macro of TOGGLE_LISTS) {
      expect(toggles.has(macro)).toBe(true);
    }
  });

  // Duas dessas páginas são montadas pelo pacote de glossário e não recebem
  // o caminho como argumento, embora tenham arquivo próprio no projeto.
  const SEM_ARGUMENTO = new Set([
    "imprimirlistadeabreviaturasesiglas",
    "imprimirglossario",
  ]);

  it("o argumento da macro aponta para o arquivo mapeado", () => {
    for (const [macro, path] of TOGGLE_FILES) {
      const argument = toggles.get(macro)?.argument;
      if (SEM_ARGUMENTO.has(macro)) {
        expect(argument).toBeNull();
        continue;
      }
      // O modelo escreve o caminho sem a extensão .tex.
      expect(argument).toBe(path.replace(/\.tex$/, ""));
    }
  });

  it("todo arquivo mapeado existe no manifesto do modelo", async () => {
    const manifest = (await import(
      "../../../../public/templates/uecetex2/manifest.json"
    )) as { files: { path: string }[] };
    const paths = new Set(manifest.files.map((f) => f.path));
    for (const path of TOGGLE_FILES.values()) expect(paths.has(path)).toBe(true);
  });
});
