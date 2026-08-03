/**
 * O que o emissor escreve nos arquivos do projeto.
 *
 * Resumo e abstract têm um contrato com o app: ele procura `\palavraschave`
 * em resumo.tex e `\keywords` em abstract.tex, e trata como corpo tudo que
 * vier antes da macro — nada pode sobrar depois dela.
 *
 * As entradas bibliográficas têm outro: o BibTeX é orientado a bytes e corta
 * UTF-8 de dois bytes ao meio ao abreviar nomes, então tudo que sai no `.bib`
 * precisa ser ASCII com os acentos em comando TeX.
 */
import { describe, expect, test } from "vitest";
import {
  authorsOf,
  bibKeys,
  emitBib,
  emitFiles,
  emitPretextual,
  selectWorkType,
  workTypeFromPreamble,
} from "../emit.js";
import { toAsciiWithTexAccents } from "../text-util.js";

describe("emitPretextual", () => {
  test("rótulo embutido no fim do parágrafo vira macro", () => {
    const out = emitPretextual("RESUMO", [
      "Este trabalho compara plataformas. Palavras-chave: ensino; correção.",
    ]);
    expect(out).toBe(
      "Este trabalho compara plataformas.\n\n\\palavraschave{ensino; correção.}\n",
    );
  });

  test("rótulo como parágrafo próprio vira macro", () => {
    const out = emitPretextual("RESUMO", [
      "Corpo do resumo.",
      "Palavras-chave: um; dois.",
    ]);
    expect(out).toBe("Corpo do resumo.\n\n\\palavraschave{um; dois.}\n");
  });

  test("ABSTRACT usa \\keywords", () => {
    const out = emitPretextual("ABSTRACT", ["Body. Keywords: one; two."]);
    expect(out).toContain("\\keywords{one; two.}");
    expect(out).not.toContain("\\palavraschave");
  });

  test("sem rótulo, não inventa macro", () => {
    const out = emitPretextual("AGRADECIMENTOS", ["Agradeço à minha família."]);
    expect(out).toBe("Agradeço à minha família.\n");
  });

  test("escapa os especiais dentro e fora da macro", () => {
    const out = emitPretextual("RESUMO", [
      "Taxa de 90% & mais. Palavras-chave: R$; 50%.",
    ]);
    expect(out).toContain("Taxa de 90\\% \\& mais.");
    expect(out).toContain("\\palavraschave{R\\$; 50\\%.}");
  });

  test("nada sobra depois da macro", () => {
    const out = emitPretextual("RESUMO", ["Corpo. Palavras-chave: a; b."]);
    expect(out.trimEnd().endsWith("}")).toBe(true);
  });
});

describe("bibKeys", () => {
  test("sobrenome com hífen entra na chave", () => {
    const entries = [
      {
        raw: "GARCÍA-MATEOS, G.; FERNÁNDEZ-ALEMÁN, J. Um título. 2009.",
        emphasized: [],
        page: 1,
      },
    ];
    expect(bibKeys(entries)).toEqual(["garciamateos2009"]);
  });

  test("sobrenome com apóstrofo entra na chave", () => {
    const entries = [{ raw: "D'ÁVILA, M. Outro título. 2015.", emphasized: [], page: 1 }];
    expect(bibKeys(entries)[0]).toBe("davila2015");
  });

  test("entrada sem vírgula nem ponto cai no fallback", () => {
    const entries = [{ raw: "sem estrutura reconhecível 2020", emphasized: [], page: 1 }];
    expect(bibKeys(entries)[0]).toBe("ref2020");
  });

  test("inicial fora do Latin-1 entra na chave", () => {
    const entries = [
      { raw: "ŠVIČEVIĆ, N.; BOGDANOVIĆ, Z. Um trabalho. 2025.", emphasized: [], page: 1 },
    ];
    expect(bibKeys(entries)[0]).toBe("svicevic2025");
  });

  test("colisão de chave ganha sufixo", () => {
    const entries = [
      { raw: "SOUSA, A. Um. 2015.", emphasized: [], page: 1 },
      { raw: "SOUSA, B. Dois. 2015.", emphasized: [], page: 2 },
    ];
    expect(bibKeys(entries)).toEqual(["sousa2015", "sousa2015x"]);
  });
});

/** Nenhum caractere acima de U+007F — é o que o BibTeX aguenta sem cortar. */
const isAscii = (s: string) => /^\p{ASCII}*$/u.test(s);

describe("toAsciiWithTexAccents", () => {
  test("acentos viram comandos e o texto fica ASCII", () => {
    const out = toAsciiWithTexAccents("ŠVIČEVIĆ, N.; Conceição");
    expect(out).toBe("{\\v{S}}VI{\\v{C}}EVI{\\'{C}}, N.; Concei{\\c{c}}{\\~{a}}o");
    expect(isAscii(out)).toBe(true);
  });

  test("letras sem decomposição têm comando próprio", () => {
    expect(toAsciiWithTexAccents("Ørsted, Łukasz")).toBe("\\O{}rsted, \\L{}ukasz");
  });

  test("letra que não reduz a ASCII é preservada, não apagada", () => {
    expect(toAsciiWithTexAccents("Δοξιάδης")).toContain("Δ");
  });

  test("texto já ASCII passa intacto", () => {
    expect(toAsciiWithTexAccents("Sousa, R.; Favero, E.")).toBe("Sousa, R.; Favero, E.");
  });

  test("as entradas do .bib não têm byte fora do ASCII", () => {
    const bib = emitBib([
      {
        raw: "ŠVIČEVIĆ, N. Educação e tecnologia. 2025.",
        emphasized: ["Educação"],
        page: 60,
      },
    ]);
    // O cabeçalho fica fora: o BibTeX ignora tudo que não é entrada `@`.
    const entries = bib.slice(bib.indexOf("@misc{"));
    expect(isAscii(entries)).toBe(true);
    expect(entries).toContain("{\\v{S}}VI");
  });
});

describe("authorsOf", () => {
  test("o ponto das iniciais não encerra a lista de autores", () => {
    expect(
      authorsOf("SOUSA, R. G.; FAVERO, E. L. Resolução de problemas. RENOTE, 2015."),
    ).toBe("SOUSA, R. G. and FAVERO, E. L.");
  });

  test("'et al.' vira 'and others', que é como o BibTeX abrevia", () => {
    expect(authorsOf("BABORI, A. et al. Terceiro trabalho. Journal, 2016.")).toBe(
      "BABORI, A. and others",
    );
  });

  test("três autores viram três nomes", () => {
    const out = authorsOf(
      "ŠVIČEVIĆ, M.; VUČIĆEVIĆ, N.; BOGDANOVIĆ, B. Um título. Journal, 2025.",
    );
    expect(out.split(" and ")).toHaveLength(3);
  });

  test("autor corporativo cai no corte antigo em vez de sumir", () => {
    expect(authorsOf("GITHUB, INC. Documentação. 2026.")).toBe("GITHUB, INC");
  });

  test("entrada sem estrutura devolve vazio", () => {
    expect(authorsOf("sem estrutura reconhecível 2020")).toBe("");
  });
});

describe("tipo de trabalho e nomes de capítulo", () => {
  test("cada tipo é reconhecido pela folha de rosto", () => {
    expect(workTypeFromPreamble("Tese apresentada ao Programa…")).toBe("tese");
    expect(workTypeFromPreamble("Dissertação apresentada ao Curso…")).toBe("dissertacao");
    expect(workTypeFromPreamble("Monografia do Curso de Especialização em Gestão")).toBe(
      "tccespecializacao",
    );
    expect(workTypeFromPreamble("Trabalho de Conclusão de Curso apresentado…")).toBe(
      "tccgraduacao",
    );
    expect(workTypeFromPreamble("Texto que não diz o tipo")).toBeNull();
  });

  test("só a linha do tipo escolhido fica ativa", () => {
    const doc = [
      "%\\trabalhoacademico{tccgraduacao}",
      "%\\trabalhoacademico{tccespecializacao}",
      "\\trabalhoacademico{dissertacao}",
      "%\\trabalhoacademico{tese}",
      "",
    ].join("\n");
    const out = selectWorkType(doc, "tese");
    expect(out).toContain("\n\\trabalhoacademico{tese}");
    expect(out).toContain("%\\trabalhoacademico{dissertacao}");
    expect(out).toContain("%\\trabalhoacademico{tccgraduacao}");
  });

  test("capítulos de mesmo título não se sobrescrevem", () => {
    const sem = {
      metadata: {},
      frontMatter: {
        institutionLines: [],
        preamble: "",
        board: [],
        has: {
          catalogCard: false,
          approvalSheet: false,
          illustrationList: false,
          tableList: false,
          abbreviationList: false,
          symbolList: false,
        },
      },
      pretextual: [],
      posttextual: [],
      bibliography: [],
      footnotes: [],
      unclassified: [],
      body: [
        {
          kind: "heading",
          level: "chapter",
          numbered: true,
          title: "Resultados",
          page: 1,
        },
        { kind: "paragraph", text: "Primeiro.", page: 1 },
        {
          kind: "heading",
          level: "chapter",
          numbered: true,
          title: "Resultados",
          page: 2,
        },
        { kind: "paragraph", text: "Segundo.", page: 2 },
      ],
    } as never;
    const template = new Map<string, Uint8Array>([
      [
        "documento.tex",
        new TextEncoder().encode(
          "\\begin{document}\n\t\\input{elementos-textuais/x}\n\\end{document}\n",
        ),
      ],
    ]);
    const { files } = emitFiles(sem, { template });
    const chapters = [...files.keys()].filter((p) => p.startsWith("elementos-textuais/"));
    expect(chapters).toHaveLength(2);
    expect(new Set(chapters).size).toBe(2);
  });

  test("citação não ligada deixa marcador no capítulo e continua no relatório", () => {
    const text = "Segundo (Desconhecido, 2011), o método falha.";
    const sem = {
      metadata: {},
      frontMatter: {
        institutionLines: [],
        preamble: "",
        board: [],
        has: {
          catalogCard: false,
          approvalSheet: false,
          illustrationList: false,
          tableList: false,
          abbreviationList: false,
          symbolList: false,
        },
      },
      pretextual: [],
      posttextual: [],
      bibliography: [],
      footnotes: [],
      unclassified: [],
      body: [
        {
          kind: "heading",
          level: "chapter",
          numbered: true,
          title: "Introdução",
          page: 3,
        },
        { kind: "paragraph", text, page: 3 },
      ],
    } as never;
    const template = new Map<string, Uint8Array>([
      [
        "documento.tex",
        new TextEncoder().encode(
          "\\begin{document}\n\t\\input{elementos-textuais/x}\n\\end{document}\n",
        ),
      ],
    ]);

    const { files, report } = emitFiles(sem, { template });
    const chapter = new TextDecoder().decode(
      files.get("elementos-textuais/introducao.tex"),
    );
    expect(chapter).toContain(text);
    expect(chapter).toContain(`%% TODO(citação): ligar às referências — ${text}`);
    expect(report.pendencias).toContainEqual({
      kind: "citacao-nao-ligada",
      page: 4,
      excerpt: text,
    });
    expect(report.citations.literal).toBe(1);
  });

  test("trecho com quebra de linha não escapa do comentário de pendência", () => {
    // O comentário do LaTeX acaba na quebra de linha: um `\n` vindo do PDF
    // jogaria a cauda do trecho para fora e ela viraria texto do documento.
    const text = "Segundo (Desconhecido, 2011),\no método\tfalha.";
    const sem = {
      metadata: {},
      frontMatter: {
        institutionLines: [],
        preamble: "",
        board: [],
        has: {
          catalogCard: false,
          approvalSheet: false,
          illustrationList: false,
          tableList: false,
          abbreviationList: false,
          symbolList: false,
        },
      },
      pretextual: [],
      posttextual: [],
      bibliography: [],
      footnotes: [],
      unclassified: [],
      body: [
        {
          kind: "heading",
          level: "chapter",
          numbered: true,
          title: "Introdução",
          page: 3,
        },
        { kind: "paragraph", text, page: 3 },
      ],
    } as never;
    const template = new Map<string, Uint8Array>([
      [
        "documento.tex",
        new TextEncoder().encode(
          "\\begin{document}\n\t\\input{elementos-textuais/x}\n\\end{document}\n",
        ),
      ],
    ]);

    const { files, report } = emitFiles(sem, { template });
    const chapter = new TextDecoder().decode(
      files.get("elementos-textuais/introducao.tex"),
    );
    const markerLine = chapter
      .split("\n")
      .find((line) => line.startsWith("%% TODO(citação)"));

    expect(markerLine).toBe(
      "%% TODO(citação): ligar às referências — Segundo (Desconhecido, 2011), o método falha.",
    );
    expect(report.pendencias).toContainEqual({
      kind: "citacao-nao-ligada",
      page: 4,
      excerpt: "Segundo (Desconhecido, 2011), o método falha.",
    });
  });

  test("imagem sem bytes vira marcador em vez de include quebrado", () => {
    const sem = {
      metadata: {},
      frontMatter: {
        institutionLines: [],
        board: [],
        has: {
          catalogCard: false,
          approvalSheet: false,
          illustrationList: false,
          tableList: false,
          abbreviationList: false,
          symbolList: false,
        },
      },
      pretextual: [],
      posttextual: [],
      bibliography: [],
      footnotes: [],
      unclassified: [],
      body: [
        {
          kind: "heading",
          level: "chapter",
          numbered: true,
          title: "Resultados",
          page: 2,
        },
        {
          kind: "figure",
          number: 1,
          caption: "Figura sem ativo",
          imageFiles: ["ausente.png"],
          page: 2,
        },
      ],
    } as never;
    const template = new Map<string, Uint8Array>([
      [
        "documento.tex",
        new TextEncoder().encode(
          "\\begin{document}\n\t\\input{elementos-textuais/x}\n\\end{document}\n",
        ),
      ],
    ]);

    const { files, report } = emitFiles(sem, { template, assets: new Map() });
    const chapter = new TextDecoder().decode(
      files.get("elementos-textuais/resultados.tex"),
    );
    expect(chapter).not.toContain("\\includegraphics");
    expect(chapter).toContain("%% TODO(figura): imagem não recuperada da IR");
    expect(report.pendencias).toContainEqual({
      kind: "figura-sem-imagem",
      page: 3,
      excerpt: "Figura sem ativo",
    });
  });

  test("mantém sequências de cifrão literais ao atualizar a capa", () => {
    const sem = {
      metadata: { title: "$&" },
      frontMatter: {
        institutionLines: [],
        board: [],
        has: {
          catalogCard: false,
          approvalSheet: false,
          illustrationList: false,
          tableList: false,
          abbreviationList: false,
          symbolList: false,
        },
      },
      pretextual: [],
      posttextual: [],
      bibliography: [],
      footnotes: [],
      unclassified: [],
      body: [
        {
          kind: "heading",
          level: "chapter",
          numbered: true,
          title: "Resultados",
          page: 1,
        },
      ],
    } as never;
    const template = new Map<string, Uint8Array>([
      [
        "documento.tex",
        new TextEncoder().encode(
          "\\titulo{Modelo}\\n\\begin{document}\\n\\t\\input{elementos-textuais/x}\\n\\end{document}\\n",
        ),
      ],
    ]);

    const { files } = emitFiles(sem, { template });
    const doc = new TextDecoder().decode(files.get("documento.tex"));
    expect(doc).toContain("\\titulo{\\$\\&}");
    expect(doc).not.toContain("\\titulo{\\titulo{Modelo}}");
  });

  test("cada nota de rodapé é anexada uma única vez e registra as inatingíveis", () => {
    const sem = {
      metadata: {},
      frontMatter: {
        institutionLines: [],
        board: [],
        has: {
          catalogCard: false,
          approvalSheet: false,
          illustrationList: false,
          tableList: false,
          abbreviationList: false,
          symbolList: false,
        },
      },
      pretextual: [],
      posttextual: [],
      bibliography: [],
      footnotes: [
        { marker: "1", text: "Nota compartilhada", page: 4 },
        { marker: "2", text: "Nota fora dos capítulos", page: 9 },
      ],
      unclassified: [],
      body: [
        {
          kind: "heading",
          level: "chapter",
          numbered: true,
          title: "Primeiro",
          page: 4,
        },
        { kind: "paragraph", text: "Texto um.", page: 4 },
        {
          kind: "heading",
          level: "chapter",
          numbered: true,
          title: "Segundo",
          page: 4,
        },
        { kind: "paragraph", text: "Texto dois.", page: 4 },
      ],
    } as never;
    const template = new Map<string, Uint8Array>([
      [
        "documento.tex",
        new TextEncoder().encode(
          "\\begin{document}\n\t\\input{elementos-textuais/x}\n\\end{document}\n",
        ),
      ],
    ]);

    const { files, report } = emitFiles(sem, { template });
    const emitted = [...files.entries()]
      .filter(([path]) => path.startsWith("elementos-textuais/"))
      .map(([, bytes]) => new TextDecoder().decode(bytes))
      .join("\n");
    expect(emitted.match(/\\footnote\{/g)).toHaveLength(1);
    expect(report.pendencias.filter((item) => item.kind === "nota-rodape")).toEqual([
      { kind: "nota-rodape", page: 5, excerpt: "Nota compartilhada" },
      { kind: "nota-rodape", page: 10, excerpt: "Nota fora dos capítulos" },
    ]);
  });
});
