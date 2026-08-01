import { bytesToText, type Project, textToBytes } from "@papyru/project-model";
import { describe, expect, it } from "vitest";
import { EMPTY_SLOT_FILLER } from "../folha-aprovacao";
import { normalizeImportedProject } from "../import-normalize";

function project(files: Record<string, string>, entry = "documento.tex"): Project {
  return {
    schemaVersion: 1,
    id: "uecetex2",
    name: "uecetex2",
    entry,
    templateSource: "https://example.invalid/uecetex2",
    files: Object.entries(files).map(([path, text]) => ({
      path,
      bytes: textToBytes(text),
      kind: "tex" as const,
      editable: false,
    })),
    updatedAt: 0,
  };
}

const COM_CENTRO_VAZIO = [
  "\\trabalhoacademico{tccgraduacao}",
  "\\orientador{Prof. Me. Ciclano}",
  "\\orientadorcentro{Centro de Ciências e Tecnologia}",
  "\\membrodabancadois{Profa. Dra. Beltrana}",
  "\\membrodabancadoiscentro{}",
  "\\begin{document}\\imprimirfolhadeaprovacao\\end{document}",
  "",
].join("\n");

describe("normalizeImportedProject", () => {
  it("repara a folha de aprovação do arquivo de entrada", () => {
    const normalized = normalizeImportedProject(
      project({ "documento.tex": COM_CENTRO_VAZIO }),
    );
    const entry = normalized.files.find((f) => f.path === "documento.tex");
    expect(bytesToText(entry?.bytes ?? new Uint8Array())).toContain(
      `\\membrodabancadoiscentro{${EMPTY_SLOT_FILLER}}`,
    );
  });

  it("converte o rótulo literal de palavras-chave do resumo e do abstract", () => {
    const normalized = normalizeImportedProject(
      project({
        "documento.tex": "\\trabalhoacademico{dissertacao}\n",
        "elementos-pre-textuais/resumo.tex": "Corpo. Palavras-chave: a; b.\n",
        "elementos-pre-textuais/abstract.tex": "Body. Keywords: c; d.\n",
      }),
    );
    const read = (path: string) =>
      bytesToText(
        normalized.files.find((f) => f.path === path)?.bytes ?? new Uint8Array(),
      );
    expect(read("elementos-pre-textuais/resumo.tex")).toContain("\\palavraschave{a; b.}");
    expect(read("elementos-pre-textuais/abstract.tex")).toContain("\\keywords{c; d.}");
  });

  it("devolve o mesmo objeto quando não há nada a normalizar", () => {
    const original = project({
      "documento.tex": "\\trabalhoacademico{dissertacao}\n",
    });
    expect(normalizeImportedProject(original)).toBe(original);
  });

  it("não toca em nenhum outro arquivo", () => {
    const original = project({
      "documento.tex": COM_CENTRO_VAZIO,
      "elementos-textuais/introducao.tex": "\\chapter{Introdução}\n",
    });
    const normalized = normalizeImportedProject(original);
    const intro = normalized.files.find(
      (f) => f.path === "elementos-textuais/introducao.tex",
    );
    expect(bytesToText(intro?.bytes ?? new Uint8Array())).toBe("\\chapter{Introdução}\n");
  });

  it("não toca em arquivo que não está em UTF-8 — os bytes seriam perdidos", () => {
    // "Palavras-chave: correção." com o "ç" em Latin-1 (0xE7).
    const latin1 = Uint8Array.from([
      ...new TextEncoder().encode("Corpo. Palavras-chave: corre"),
      0xe7,
      ...new TextEncoder().encode("ao.\n"),
    ]);
    const original = project({ "documento.tex": "\\trabalhoacademico{dissertacao}\n" });
    original.files.push({
      path: "elementos-pre-textuais/resumo.tex",
      bytes: latin1,
      kind: "tex",
      editable: false,
    });
    const normalized = normalizeImportedProject(original);
    expect(
      normalized.files.find((f) => f.path === "elementos-pre-textuais/resumo.tex")?.bytes,
    ).toBe(latin1);
  });

  it("tolera um projeto cujo arquivo de entrada não existe", () => {
    const original = project({ "outro.tex": "\\documentclass{article}\n" });
    expect(normalizeImportedProject(original)).toBe(original);
  });
});
