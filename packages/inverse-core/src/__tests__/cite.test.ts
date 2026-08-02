/**
 * Citações autor-data (NBR 10520:2023) → comandos abntex2cite.
 *
 * Regra de ouro: na dúvida, deixar literal. Nunca inventar chave, nunca
 * converter um parêntese que não resolveu por inteiro — um `\cite` para uma
 * chave inexistente quebra a geração do PDF e mente sobre a bibliografia.
 *
 * As strings vêm de um documento real.
 */
import { describe, expect, test } from "vitest";
import { buildCiteIndex, countUnresolved, segmentCitations } from "../cite.js";
import type { BibEntry } from "../semantic.js";

const entry = (raw: string): BibEntry => ({ raw, emphasized: [], page: 60 });

/** Bibliografia sintética com os formatos que o documento real usa. */
const ENTRIES: BibEntry[] = [
  entry("SOUSA, R.; FAVERO, E. Um estudo sobre correção. 2015."),
  entry("GARCÍA-MATEOS, G.; FERNÁNDEZ-ALEMÁN, J. Primeiro trabalho. 2009."),
  entry("GARCÍA-MATEOS, G.; FERNÁNDEZ-ALEMÁN, J. Segundo trabalho. 2009."),
  entry("BABORI, A. et al. Terceiro trabalho. 2016."),
  entry("NGUYEN, A. et al. Quarto trabalho. 2014."),
  entry("ŠVIČEVIĆ, N.; VUČIĆEVIĆ, M.; BOGDANOVIĆ, Z. Quinto trabalho. 2025."),
  entry("MARANGA, A. et al. Sexto trabalho. 2019."),
  entry("GITHUB, INC. Documentação. 2026."),
  entry("YUEN, C.; LIU, D.; LEONG, H. Sétimo trabalho. 2023."),
  entry("NISHANOV, A. et al. Oitavo trabalho. 2024."),
  entry("SANTOS, M. Nono trabalho. 2020."),
];

const index = buildCiteIndex(ENTRIES);

/** Renderiza os segmentos como o emissor faria, sem escapar o texto. */
function render(text: string): string {
  return segmentCitations(text, index)
    .map((s) => {
      if (s.kind === "text") return s.value;
      if (s.kind === "citeonline") return `\\citeonline{${s.key}}`;
      return `\\cite${s.suffix ? `[${s.suffix}]` : ""}{${s.keys.join(",")}}`;
    })
    .join("");
}

describe("citação parentética", () => {
  test("dois autores, uma obra", () => {
    expect(render("Como aponta (Sousa; Favero, 2015).")).toBe(
      "Como aponta \\cite{sousa2015}.",
    );
  });

  test("três obras, com sufixos a/b", () => {
    const text =
      "Vários (García-mateos; Fernández-alemán, 2009a; García-mateos; " +
      "Fernández-alemán, 2009b; Babori et al., 2016) discutem.";
    expect(render(text)).toBe(
      "Vários \\cite{garciamateos2009,garciamateos2009x,babori2016} discutem.",
    );
  });

  test("et al. com diacríticos e três autores", () => {
    const text =
      "Estudos (Nguyen et al., 2014; Švičević; Vučićević; Bogdanović, 2025; " +
      "Maranga et al., 2019) apontam.";
    expect(render(text)).toBe(
      "Estudos \\cite{nguyen2014,svicevic2025,maranga2019} apontam.",
    );
  });

  test("autor corporativo com vírgula interna", () => {
    expect(render("Segundo (GitHub, Inc., 2026).")).toBe("Segundo \\cite{github2026}.");
  });

  test("tolera espaço espúrio antes da vírgula", () => {
    expect(render("Em (Nguyen et al. , 2014).")).toBe("Em \\cite{nguyen2014}.");
  });

  test("página vira argumento opcional", () => {
    expect(render("Ver (Santos, 2020, p. 15).")).toBe("Ver \\cite[p.~15]{santos2020}.");
  });

  test("intervalo de páginas", () => {
    expect(render("Ver (Santos, 2020, p. 15-18).")).toBe(
      "Ver \\cite[p.~15-18]{santos2020}.",
    );
  });
});

describe("o que NÃO é citação fica literal", () => {
  test("parêntese comum", () => {
    const text = "Isto acontece (por exemplo, na prática) com frequência.";
    expect(render(text)).toBe(text);
  });

  test("sigla", () => {
    const text = "A Universidade Estadual do Ceará (UECE) mantém o curso.";
    expect(render(text)).toBe(text);
  });

  test("autor fora da bibliografia", () => {
    const text = "Conforme (Desconhecido, 2011), o método falha.";
    expect(render(text)).toBe(text);
  });

  test("ano ambíguo sem sufixo não resolve", () => {
    const ambiguo = buildCiteIndex([
      entry("SILVA, A. Um. 2018."),
      entry("SILVA, B. Dois. 2018."),
    ]);
    const text = "Segundo (Silva, 2018), há divergência.";
    expect(
      segmentCitations(text, ambiguo)
        .map((s) => (s.kind === "text" ? s.value : "!"))
        .join(""),
    ).toBe(text);
  });

  test("uma obra não resolvida deixa o parêntese inteiro literal", () => {
    const text = "Vários (Sousa; Favero, 2015; Desconhecido, 1999) discordam.";
    expect(render(text)).toBe(text);
  });
});

describe("citação narrativa", () => {
  test("dois autores ligados por 'e'", () => {
    expect(render("Sousa e Favero (2015) mostraram que sim.")).toBe(
      "\\citeonline{sousa2015} mostraram que sim.",
    );
  });

  test("et al.", () => {
    expect(render("Nguyen et al. (2014) analisaram.")).toBe(
      "\\citeonline{nguyen2014} analisaram.",
    );
  });

  test("sem entrada na bibliografia fica literal", () => {
    const text = "Fulano (2011) afirmou o contrário.";
    expect(render(text)).toBe(text);
  });

  test("sufixo de ano resolve a obra certa", () => {
    expect(render("García-mateos e Fernández-alemán (2009b) ampliaram.")).toBe(
      "\\citeonline{garciamateos2009x} ampliaram.",
    );
  });
});

describe("countUnresolved", () => {
  test("conta o parêntese que parece citação e não resolveu", () => {
    expect(countUnresolved("Conforme (Desconhecido, 2011), o método falha.", index)).toBe(
      1,
    );
  });

  test("não conta parêntese que não é citação", () => {
    expect(countUnresolved("Isto acontece (por exemplo, na prática).", index)).toBe(0);
  });

  test("não conta citação resolvida", () => {
    expect(countUnresolved("Como aponta (Sousa; Favero, 2015).", index)).toBe(0);
  });

  test("conta narrativa candidata não resolvida", () => {
    expect(countUnresolved("Fulano et al. (2011) afirmaram.", index)).toBe(1);
  });
});

describe("determinismo", () => {
  test("duas execuções produzem o mesmo resultado", () => {
    const text =
      "Vários (Sousa; Favero, 2015; Babori et al., 2016) e Nguyen et al. (2014).";
    expect(render(text)).toBe(render(text));
  });
});
