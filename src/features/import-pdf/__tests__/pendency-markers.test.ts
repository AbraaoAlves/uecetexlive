import { describe, expect, it } from "vitest";
import { removePendencyMarkerAtLine, scanPendencyMarkers } from "../pendency-markers";

describe("scanPendencyMarkers", () => {
  it("normalizes known labels and follows document order before alphabetical extras", () => {
    const texSources = {
      "fora-z.tex": "%% TODO(rótulo inventado): preservar isto",
      "capitulo-b.tex": [
        "%% TODO(figura): imagem não recuperada da IR",
        "texto",
        "%% TODO(algoritmo): reconstruir marcação algorithm2e; conteúdo extraído:",
      ].join("\n"),
      "capitulo-a.tex": [
        "Primeira linha",
        "%% TODO(matemática inline): revisar símbolos neste parágrafo",
        "%% TODO(matemática): reconstruir a partir dos glifos extraídos:",
        "Texto com nota %% TODO(nota 3): reancorar na palavra exata (p7)",
      ].join("\n"),
      "fora-a.tex": "%% TODO(citação): ligar às referências — trecho",
    };

    expect(
      scanPendencyMarkers(texSources, [
        "capitulo-a.tex",
        "capitulo-b.tex",
        "ausente.tex",
        "capitulo-a.tex",
      ]),
    ).toEqual([
      {
        kind: "equacao-inline",
        path: "capitulo-a.tex",
        line: 2,
        detail: "revisar símbolos neste parágrafo",
      },
      {
        kind: "equacao",
        path: "capitulo-a.tex",
        line: 3,
        detail: "reconstruir a partir dos glifos extraídos:",
      },
      {
        kind: "nota-rodape",
        path: "capitulo-a.tex",
        line: 4,
        detail: "reancorar na palavra exata (p7)",
      },
      {
        kind: "figura-sem-imagem",
        path: "capitulo-b.tex",
        line: 1,
        detail: "imagem não recuperada da IR",
      },
      {
        kind: "algoritmo",
        path: "capitulo-b.tex",
        line: 3,
        detail: "reconstruir marcação algorithm2e; conteúdo extraído:",
      },
      {
        kind: "citacao-nao-ligada",
        path: "fora-a.tex",
        line: 1,
        detail: "ligar às referências — trecho",
      },
      {
        kind: { other: "rótulo inventado" },
        path: "fora-z.tex",
        line: 1,
        detail: "preservar isto",
      },
    ]);
  });

  it("accepts variable footnote numbers and ignores ordinary comments", () => {
    const texSources = {
      "cap.tex": [
        "% TODO(nota 1): comentário comum",
        "%% TODO(nota 12): reancorar na palavra exata (p9)",
      ].join("\n"),
    };

    expect(scanPendencyMarkers(texSources, ["cap.tex"])).toEqual([
      {
        kind: "nota-rodape",
        path: "cap.tex",
        line: 2,
        detail: "reancorar na palavra exata (p9)",
      },
    ]);
  });
});

describe("removePendencyMarkerAtLine", () => {
  it("removes an own-line marker with its original CRLF", () => {
    const source = "Antes\r\n%% TODO(matemática): reconstruir a equação\r\nDepois\r\n";
    expect(removePendencyMarkerAtLine(source, 2)).toBe("Antes\r\nDepois\r\n");
  });

  it("removes only the marker suffix when it follows content", () => {
    const source =
      "Texto\\footnote{Nota} %% TODO(nota 3): reancorar na palavra exata (p7)\nDepois";
    expect(removePendencyMarkerAtLine(source, 1)).toBe("Texto\\footnote{Nota} \nDepois");
  });

  it("leaves the source byte-identical when the requested line has no marker", () => {
    const source = "Antes\n%% TODO(figura): recuperar imagem\nDepois";
    expect(removePendencyMarkerAtLine(source, 3)).toBe(source);
    expect(removePendencyMarkerAtLine(source, 99)).toBe(source);
  });
});
