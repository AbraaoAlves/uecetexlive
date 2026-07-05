import { describe, expect, it } from "vitest";
import introducaoTex from "../../../../public/templates/uecetex2/files/elementos-textuais/introducao.tex?raw";
import { countLatexWords } from "../word-count";

describe("countLatexWords", () => {
  it("counts plain prose", () => {
    expect(countLatexWords("Uma frase com cinco palavras.")).toBe(5);
  });

  it("keeps the prose inside styling macros", () => {
    expect(countLatexWords("Um \\textbf{resultado importante} aqui.")).toBe(4);
  });

  it("counts section titles as prose", () => {
    expect(countLatexWords("\\chapter{Estudo de Caso}\n\nCorpo do texto.")).toBe(6);
  });

  it("drops comments but not escaped percent", () => {
    expect(countLatexWords("linha real % comentário longo ignorado")).toBe(2);
    expect(countLatexWords("cresceu 50\\% ao ano")).toBe(4);
  });

  it("drops plumbing macro arguments (cite/ref/label/includegraphics)", () => {
    const src =
      "Como \\cite{lamport1986latex} mostra na \\ref{fig:x}.\n" +
      "\\label{sec:y}\n" +
      "\\includegraphics[width=0.8\\textwidth]{figuras/figura-1}";
    expect(countLatexWords(src)).toBe(3); // Como, mostra, na
  });

  it("drops math", () => {
    expect(countLatexWords("Seja $x = 1$ o valor \\[ y = 2 \\] final.")).toBe(4);
    expect(
      countLatexWords("Antes\n\\begin{equation}\nE = mc^2\n\\end{equation}\ndepois"),
    ).toBe(2);
  });

  it("drops code listings", () => {
    expect(
      countLatexWords(
        "Veja:\n\\begin{lstlisting}\nint main() { return 0; }\n\\end{lstlisting}\nfim",
      ),
    ).toBe(2);
  });

  it("counts list items without counting the environment tokens", () => {
    const src =
      "\\begin{alineas}\n\t\\item primeiro item\n\t\\item segundo item\n\\end{alineas}";
    expect(countLatexWords(src)).toBe(4);
  });

  it("treats hyphenated and accented words as single words", () => {
    expect(countLatexWords("guarda-chuva é útil")).toBe(3);
  });

  it("empty and macro-only sources count zero", () => {
    expect(countLatexWords("")).toBe(0);
    expect(countLatexWords("\\clearpage\n\\newpage")).toBe(0);
  });

  it("template introducao.tex lands in a sane range", () => {
    const n = countLatexWords(introducaoTex);
    expect(n).toBeGreaterThan(300);
    expect(n).toBeLessThan(1200);
  });
});
