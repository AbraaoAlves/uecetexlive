import { describe, expect, it } from "vitest";
import { rewriteInputOrder } from "../reorder";

const doc = `%% cabeçalho
\\input{lib/preambulo}

\\begin{document}
\t\\textual
\t\\input{elementos-textuais/introducao}
\t\\input{elementos-textuais/metodologia}
\t\\input{elementos-textuais/conclusao}
\\end{document}
`;

describe("rewriteInputOrder (§4.6 chapter reorder)", () => {
  it("swaps two chapters, preserving everything else byte-exact", () => {
    const result = rewriteInputOrder(
      doc,
      [
        "elementos-textuais/introducao",
        "elementos-textuais/metodologia",
        "elementos-textuais/conclusao",
      ],
      [
        "elementos-textuais/metodologia",
        "elementos-textuais/introducao",
        "elementos-textuais/conclusao",
      ],
    );
    expect(result).toBe(
      doc
        .replace("\\input{elementos-textuais/introducao}", "@@TMP@@")
        .replace(
          "\\input{elementos-textuais/metodologia}",
          "\\input{elementos-textuais/introducao}",
        )
        .replace("@@TMP@@", "\\input{elementos-textuais/metodologia}"),
    );
    // preambulo untouched, structure identical
    expect(result).toContain("\\input{lib/preambulo}");
    expect(result.split("\n")).toHaveLength(doc.split("\n").length);
  });

  it("returns the source unchanged when order already matches", () => {
    const order = [
      "elementos-textuais/introducao",
      "elementos-textuais/metodologia",
      "elementos-textuais/conclusao",
    ];
    const result = rewriteInputOrder(doc, order, order);
    expect(result).toBe(doc);
  });

  it("throws when the new order does not cover the same set", () => {
    expect(() =>
      rewriteInputOrder(
        doc,
        ["elementos-textuais/introducao", "elementos-textuais/metodologia"],
        ["elementos-textuais/introducao"],
      ),
    ).toThrow(/mesmo conjunto/);
    expect(() => rewriteInputOrder(doc, ["nao-existe"], ["nao-existe"])).toThrow(
      /mesmo conjunto/,
    );
  });
});
