import { describe, expect, it } from "vitest";
import documentoTex from "../../../../public/templates/uecetex2/files/documento.tex?raw";
import {
  applyImprimirToggle,
  extractImprimirToggles,
  LANGUAGE_MACRO,
  TOGGLE_FILES,
  TOGGLE_LISTS,
  togglesByFile,
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

  it("macro repetida não vira controle — o LaTeX executa as duas linhas", () => {
    const source = doc("\t\\imprimirepigrafe{a}\n\t%\\imprimirepigrafe{b}");
    expect(extractImprimirToggles(source).has("imprimirepigrafe")).toBe(false);
  });

  it("lê um documento com quebras de linha do Windows", () => {
    const source = doc("\t\\imprimirepigrafe{x}\n\t%\\imprimirerrata{y}").replace(
      /\n/g,
      "\r\n",
    );
    const toggles = extractImprimirToggles(source);
    expect(toggles.get("imprimirepigrafe")?.enabled).toBe(true);
    expect(toggles.get("imprimirerrata")?.enabled).toBe(false);
    expect(applyImprimirToggle(source, "imprimirepigrafe", false)).toContain(
      "\t%\\imprimirepigrafe{x}\r\n",
    );
  });

  it("ignora \\begin{document} e \\end{document} comentados", () => {
    const source = [
      "% \\begin{document} — exemplo no preâmbulo",
      "\\imprimirepigrafe{fora}",
      "\\begin{document}",
      "\t\\imprimirerrata{dentro}",
      "% \\end{document} — exemplo",
      "\t\\imprimirglossario",
      "\\end{document}",
      "\t\\imprimirindice",
      "",
    ].join("\n");
    const toggles = extractImprimirToggles(source);
    expect(toggles.has("imprimirepigrafe")).toBe(false);
    expect(toggles.has("imprimirerrata")).toBe(true);
    expect(toggles.has("imprimirglossario")).toBe(true);
    expect(toggles.has("imprimirindice")).toBe(false);
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

  it("é no-op quando a macro está repetida — nenhuma escolha estaria certa", () => {
    const duplicado = doc("\t\\imprimirepigrafe{a}\n\t\\imprimirepigrafe{b}");
    expect(applyImprimirToggle(duplicado, "imprimirepigrafe", false)).toBe(duplicado);
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

describe("togglesByFile", () => {
  it("usa o caminho canônico quando a macro não tem argumento", () => {
    const byFile = togglesByFile(extractImprimirToggles(doc("\t\\imprimirglossario")));
    expect(byFile.get("elementos-pos-textuais/glossario.tex")?.macro).toBe(
      "imprimirglossario",
    );
  });

  it("segue o caminho escrito no documento, não o canônico", () => {
    const byFile = togglesByFile(
      extractImprimirToggles(doc("\t\\imprimiragradecimentos{outro/obrigado}")),
    );
    expect(byFile.get("outro/obrigado.tex")?.macro).toBe("imprimiragradecimentos");
    expect(byFile.has("elementos-pre-textuais/agradecimentos.tex")).toBe(false);
  });

  it("aceita o caminho já com extensão", () => {
    const byFile = togglesByFile(
      extractImprimirToggles(doc("\t\\imprimirepigrafe{outro/epigrafe.tex}")),
    );
    expect(byFile.has("outro/epigrafe.tex")).toBe(true);
  });

  it("deixa de fora as listas automáticas, que não têm arquivo", () => {
    const byFile = togglesByFile(
      extractImprimirToggles(doc("\t\\imprimirlistadetabelas")),
    );
    expect(byFile.size).toBe(0);
  });
});

describe("selectlanguage — mesma mecânica, sem arquivo", () => {
  const source = doc(
    "\t% Se o seu trabalho é em ingles, descomente a linha a seguir\n\t%\\selectlanguage{english}",
  );

  it("lê o estado da linha do idioma", () => {
    const toggle = extractImprimirToggles(source).get(LANGUAGE_MACRO);
    expect(toggle?.enabled).toBe(false);
    expect(toggle?.argument).toBe("english");
  });

  it("liga e desliga como as demais", () => {
    const on = applyImprimirToggle(source, LANGUAGE_MACRO, true);
    expect(on).toContain("\t\\selectlanguage{english}");
    expect(applyImprimirToggle(on, LANGUAGE_MACRO, false)).toBe(source);
  });

  it("fica de fora do índice por arquivo — não tem arquivo próprio", () => {
    expect(togglesByFile(extractImprimirToggles(source)).size).toBe(0);
  });

  it("o modelo vendorado traz a linha comentada", () => {
    expect(extractImprimirToggles(documentoTex).get(LANGUAGE_MACRO)?.enabled).toBe(false);
  });
});
