import { describe, expect, it } from "vitest";
import documentoTex from "../../../../public/templates/uecetex2/files/documento.tex?raw";
import styTex from "../../../../public/templates/uecetex2/files/lib/uecetex2.sty?raw";
import {
  EMPTY_SLOT_FILLER,
  isEmptySlotFiller,
  repairFolhaAprovacao,
  SIGNATURE_SLOTS,
  withHiddenSlotFillers,
} from "../folha-aprovacao";
import { extractMetadata } from "../metadata";

/** Preâmbulo mínimo com os campos que a folha de aprovação imprime. */
function doc(fields: Record<string, string>, type = "tccgraduacao"): string {
  const lines = [
    `\\trabalhoacademico{${type}}`,
    "\\autor{Fulana de Tal}",
    ...Object.entries(fields).map(([macro, value]) => `\\${macro}{${value}}`),
    "",
    "\\begin{document}",
    "\t\\imprimirfolhadeaprovacao",
    "\\end{document}",
    "",
  ];
  return lines.join("\n");
}

const FULL_ORIENTADOR = {
  orientador: "Prof. Me. Ciclano",
  orientadorcentro: "Centro de Ciências e Tecnologia",
  orientadories: "Universidade Estadual do Ceará",
};

describe("repairFolhaAprovacao", () => {
  it("preenche o centro vazio do membro nomeado", () => {
    const source = doc({
      ...FULL_ORIENTADOR,
      membrodabancadois: "Profa. Dra. Beltrana",
      membrodabancadoiscentro: "",
      membrodabancadoisies: "Universidade Aberta do Brasil",
    });
    const repaired = repairFolhaAprovacao(source);
    expect(repaired).not.toBeNull();
    expect(repaired).toContain(`\\membrodabancadoiscentro{${EMPTY_SLOT_FILLER}}`);
    // Só o campo em falta muda.
    expect(repaired).toContain("\\membrodabancadoisies{Universidade Aberta do Brasil}");
    expect(repaired).toContain("\\membrodabancadois{Profa. Dra. Beltrana}");
  });

  it("não inventa dado: o valor do membro e da instituição ficam intactos", () => {
    const source = doc({
      ...FULL_ORIENTADOR,
      membrodabancadois: "Profa. Dra. Beltrana",
      membrodabancadoiscentro: "",
      membrodabancadoisies: "Universidade Aberta do Brasil",
    });
    const repaired = repairFolhaAprovacao(source) ?? "";
    expect(repaired).not.toContain(
      "\\membrodabancadoiscentro{Universidade Aberta do Brasil}",
    );
  });

  it("devolve null quando todos os campos impressos estão preenchidos", () => {
    const source = doc({
      ...FULL_ORIENTADOR,
      membrodabancadois: "Profa. Dra. Beltrana",
      membrodabancadoiscentro: "Faculdade de Educação",
      membrodabancadoisies: "Universidade Aberta do Brasil",
    });
    expect(repairFolhaAprovacao(source)).toBeNull();
  });

  it("ignora o membro sem nome — a assinatura inteira não é impressa", () => {
    const source = doc({
      ...FULL_ORIENTADOR,
      membrodabancatres: "",
      membrodabancatrescentro: "",
      membrodabancatresies: "",
    });
    expect(repairFolhaAprovacao(source)).toBeNull();
  });

  it("corrige o orientador mesmo sem nome — a assinatura dele é sempre impressa", () => {
    const source = doc({
      orientador: "Prof. Me. Ciclano",
      orientadorcentro: "",
      orientadories: "Universidade Estadual do Ceará",
    });
    expect(repairFolhaAprovacao(source)).toContain(
      `\\orientadorcentro{${EMPTY_SLOT_FILLER}}`,
    );
  });

  it("corrige o coorientador só quando ele existe", () => {
    const semCoorientador = doc({
      ...FULL_ORIENTADOR,
      coorientador: "",
      coorientadorcentro: "",
    });
    expect(repairFolhaAprovacao(semCoorientador)).toBeNull();

    const comCoorientador = doc({
      ...FULL_ORIENTADOR,
      coorientador: "Prof. Dr. Sicrano",
      coorientadorcentro: "",
      coorientadories: "Universidade Estadual do Ceará",
    });
    expect(repairFolhaAprovacao(comCoorientador)).toContain(
      `\\coorientadorcentro{${EMPTY_SLOT_FILLER}}`,
    );
  });

  it("corrige vários campos numa passagem só", () => {
    const source = doc({
      ...FULL_ORIENTADOR,
      membrodabancadois: "Profa. Dra. Beltrana",
      membrodabancadoiscentro: "",
      membrodabancatres: "Prof. Me. Deltrano",
      membrodabancatrescentro: "",
    });
    const repaired = repairFolhaAprovacao(source) ?? "";
    expect(repaired).toContain(`\\membrodabancadoiscentro{${EMPTY_SLOT_FILLER}}`);
    expect(repaired).toContain(`\\membrodabancatrescentro{${EMPTY_SLOT_FILLER}}`);
  });

  it("trata campo só com espaços como vazio", () => {
    const source = doc({
      ...FULL_ORIENTADOR,
      membrodabancadois: "Profa. Dra. Beltrana",
      membrodabancadoiscentro: "   ",
    });
    expect(repairFolhaAprovacao(source)).toContain(
      `\\membrodabancadoiscentro{${EMPTY_SLOT_FILLER}}`,
    );
  });

  it("é idempotente — a segunda passagem não muda nada", () => {
    const source = doc({
      ...FULL_ORIENTADOR,
      membrodabancadois: "Profa. Dra. Beltrana",
      membrodabancadoiscentro: "",
    });
    const once = repairFolhaAprovacao(source);
    expect(once).not.toBeNull();
    expect(repairFolhaAprovacao(once ?? "")).toBeNull();
  });

  it("não mexe em dissertação/tese — essa folha não imprime o centro", () => {
    const source = doc(
      {
        ...FULL_ORIENTADOR,
        orientadorcentro: "",
        membrodabancadois: "Profa. Dra. Beltrana",
        membrodabancadoiscentro: "",
      },
      "dissertacao",
    );
    expect(repairFolhaAprovacao(source)).toBeNull();
  });

  it("trata tipo desconhecido como TCC — é o ramo padrão do modelo", () => {
    const source = doc(
      {
        ...FULL_ORIENTADOR,
        membrodabancadois: "Profa. Dra. Beltrana",
        membrodabancadoiscentro: "",
      },
      "outracoisa",
    );
    expect(repairFolhaAprovacao(source)).not.toBeNull();
  });

  it("ignora um documento sem os campos da banca", () => {
    expect(repairFolhaAprovacao("\\documentclass{article}\n")).toBeNull();
  });

  it("mantém o documento.tex vendorado intacto", () => {
    expect(repairFolhaAprovacao(documentoTex)).toBeNull();
  });
});

describe("withHiddenSlotFillers", () => {
  it("mostra o campo preenchido pelo app como vazio no wizard", () => {
    const source =
      repairFolhaAprovacao(
        doc({
          ...FULL_ORIENTADOR,
          membrodabancadois: "Profa. Dra. Beltrana",
          membrodabancadoiscentro: "",
        }),
      ) ?? "";
    const visible = withHiddenSlotFillers(extractMetadata(source));
    expect(visible.get("membrodabancadoiscentro")?.value).toBe("");
  });

  it("preserva o que o autor digitou", () => {
    const source = doc({
      ...FULL_ORIENTADOR,
      membrodabancadois: "Profa. Dra. Beltrana",
      membrodabancadoiscentro: "Faculdade de Educação",
    });
    const visible = withHiddenSlotFillers(extractMetadata(source));
    expect(visible.get("membrodabancadoiscentro")?.value).toBe("Faculdade de Educação");
    expect(visible.get("orientadorcentro")?.value).toBe(
      "Centro de Ciências e Tecnologia",
    );
  });
});

describe("isEmptySlotFiller", () => {
  it("reconhece o preenchimento do app, com ou sem espaços", () => {
    expect(isEmptySlotFiller(EMPTY_SLOT_FILLER)).toBe(true);
    expect(isEmptySlotFiller(` ${EMPTY_SLOT_FILLER} `)).toBe(true);
  });

  it("não confunde com texto do usuário", () => {
    expect(isEmptySlotFiller("")).toBe(false);
    expect(isEmptySlotFiller("Centro de Ciências e Tecnologia")).toBe(false);
  });
});

describe("sentinela do modelo vendorado", () => {
  const tccBlock = styTex.slice(
    styTex.indexOf("\\newcommand{\\imprimirfolhadeaprovacaotcc}"),
    styTex.indexOf("\\newcommand{\\imprimirfolhadeaprovacao}"),
  );

  it("a folha de TCC ainda junta nome, centro e instituição com \\\\", () => {
    expect(tccBlock.length).toBeGreaterThan(0);
    for (const slot of SIGNATURE_SLOTS) {
      // O modelo escreve ora `…centro \\`, ora `…centro\\` (sem espaço).
      expect(tccBlock).toMatch(new RegExp(`\\\\imprimir${slot.centroMacro}\\s*\\\\\\\\`));
    }
  });

  it("a folha de dissertação continua sem imprimir o centro", () => {
    const dissertacaoBlock = styTex.slice(
      styTex.indexOf("\\newcommand{\\imprimirfolhadeaprovacaodissertacao}"),
      styTex.indexOf("\\newcommand{\\imprimirfolhadeaprovacaotcc}"),
    );
    expect(dissertacaoBlock.length).toBeGreaterThan(0);
    expect(dissertacaoBlock).not.toContain("centro");
  });
});
