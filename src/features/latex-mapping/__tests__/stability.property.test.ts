import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseLatex } from "../parse";
import { serializeDoc } from "../serialize";
import type { PMDoc, PMNode } from "../types";

/**
 * Invariant #2 (§4.3): parse(serialize(d)) is deep-equal to d for GENERATED
 * docs (canonical serialization, no fidelity attrs). Fidelity attrs
 * (gapBefore/gapAfter/srcLine/rawSource) are parser bookkeeping and are
 * stripped before comparison.
 */

const FIDELITY_ATTRS = new Set(["gapBefore", "gapAfter", "srcLine", "rawSource"]);

function normalize(node: PMNode): PMNode {
  const out: PMNode = { type: node.type };
  if (node.text !== undefined) out.text = node.text;
  if (node.marks?.length) out.marks = node.marks;
  if (node.attrs) {
    const attrs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node.attrs)) {
      if (!FIDELITY_ATTRS.has(k)) attrs[k] = v;
    }
    if (Object.keys(attrs).length > 0) out.attrs = attrs;
  }
  if (node.content) out.content = node.content.map(normalize);
  return out;
}

function normalizeDoc(doc: PMDoc): PMNode[] {
  return doc.content.map(normalize);
}

// --- generators -----------------------------------------------------------

const word = fc
  .string({
    unit: fc.constantFrom(..."abcdefghixyzáéçãõABCXZ0123456789"),
    minLength: 1,
    maxLength: 8,
  })
  .map((s) => s);

const plainText = fc
  .array(word, { minLength: 1, maxLength: 6 })
  .map((words) => words.join(" "));

const textWithSpecials = fc
  .tuple(plainText, fc.constantFrom("%", "&", "_", "#"), plainText)
  .map(([a, ch, b]) => `${a}${ch}${b}`);

const key = fc
  .string({
    unit: fc.constantFrom(..."abcdefgxyz0123456789:-"),
    minLength: 1,
    maxLength: 10,
  })
  .map((s) => s.replace(/^[:-]+/, "k"));

const textNode = (arb: fc.Arbitrary<string>): fc.Arbitrary<PMNode> =>
  arb.map((t) => ({ type: "text", text: t }));

const markedText: fc.Arbitrary<PMNode> = fc
  .tuple(
    plainText,
    fc.constantFrom(
      { type: "bold", attrs: { cmd: "textbf" } },
      { type: "italic", attrs: { cmd: "textit" } },
      { type: "italic", attrs: { cmd: "emph" } },
      { type: "underline", attrs: { cmd: "underline" } },
      { type: "code", attrs: { cmd: "texttt" } },
    ),
  )
  .map(([t, mark]) => ({ type: "text", text: t, marks: [mark] }));

const citation: fc.Arbitrary<PMNode> = fc
  .array(key, { minLength: 1, maxLength: 3 })
  .map((keys) => ({
    type: "citation",
    attrs: { cmd: "cite", keys, opt: null },
  }));

const crossref: fc.Arbitrary<PMNode> = fc
  .tuple(fc.constantFrom("ref", "autoref", "pageref"), key)
  .map(([cmd, target]) => ({ type: "crossref", attrs: { cmd, target } }));

const mathInline: fc.Arbitrary<PMNode> = fc
  .string({
    unit: fc.constantFrom(..."abcxyz0123456789+-=^ "),
    minLength: 1,
    maxLength: 10,
  })
  .filter((tex) => tex.trim().length > 0)
  .map((tex) => ({
    type: "mathInline",
    attrs: { tex, delim: "dollar" },
  }));

const inlineAtom = fc.oneof(citation, crossref, mathInline, markedText);

/** Paragraph content: text/atom alternation, never adjacent plain texts. */
const paragraphContent: fc.Arbitrary<PMNode[]> = fc
  .tuple(
    textNode(fc.oneof(plainText, textWithSpecials)),
    fc.array(fc.tuple(inlineAtom, textNode(plainText)), { maxLength: 2 }),
  )
  .map(([head, pairs]) => {
    const out: PMNode[] = [head];
    for (const [atom, tail] of pairs) {
      out.push(atom, { type: "text", text: ` ${tail.text ?? ""}` });
    }
    return out;
  });

const paragraph: fc.Arbitrary<PMNode> = paragraphContent.map((content) => ({
  type: "paragraph",
  content,
}));

const heading: fc.Arbitrary<PMNode> = fc
  .tuple(
    fc.constantFrom(
      [1, "chapter"] as const,
      [2, "section"] as const,
      [3, "subsection"] as const,
      [4, "subsubsection"] as const,
    ),
    fc.boolean(),
    plainText,
  )
  .map(([[level, cmd], starred, title]) => ({
    type: "heading",
    attrs: { level, cmd, starred },
    content: [{ type: "text", text: title }],
  }));

const listItemOf = (content: PMNode[]): PMNode => ({
  type: "listItem",
  content,
});

const flatList: fc.Arbitrary<PMNode> = fc
  .tuple(
    fc.constantFrom("bulletList", "orderedList"),
    fc.array(plainText, { minLength: 1, maxLength: 3 }),
  )
  .map(([type, items]) => ({
    type,
    content: items.map((t) =>
      listItemOf([{ type: "paragraph", content: [{ type: "text", text: t }] }]),
    ),
  }));

const blockquote: fc.Arbitrary<PMNode> = fc
  .array(plainText, { minLength: 1, maxLength: 2 })
  .map((paragraphs) => ({
    type: "blockquote",
    attrs: { env: "citacao" },
    content: paragraphs.map((t) => ({
      type: "paragraph",
      content: [{ type: "text", text: t }],
    })),
  }));

const mathBlock: fc.Arbitrary<PMNode> = fc
  .tuple(
    fc.constantFrom("equation", "align", "display"),
    fc.string({
      unit: fc.constantFrom(..."abcxyz0123456789+-= "),
      minLength: 1,
      maxLength: 12,
    }),
  )
  .filter(([, tex]) => tex.trim().length > 0)
  .map(([env, tex]) => ({ type: "mathBlock", attrs: { env, tex } }));

const codeInclude: fc.Arbitrary<PMNode> = fc
  .tuple(fc.option(fc.constant("language=C++"), { nil: null }), key)
  .map(([options, file]) => ({
    type: "codeInclude",
    attrs: { options, file: `figuras/${file}.cpp` },
  }));

const rawLatexBlock: fc.Arbitrary<PMNode> = key.map((k) => ({
  type: "rawLatexBlock",
  attrs: { latex: `\\newcommand{\\x${k.replace(/[^a-z]/g, "")}x}{y}` },
}));

const block = fc.oneof(
  { weight: 4, arbitrary: paragraph },
  { weight: 2, arbitrary: heading },
  flatList,
  blockquote,
  mathBlock,
  codeInclude,
  rawLatexBlock,
);

const generatedDoc: fc.Arbitrary<PMDoc> = fc
  .array(block, { minLength: 1, maxLength: 6 })
  .map((content) => ({ type: "doc", content }));

// --- the property ----------------------------------------------------------

describe("Invariant #2 — stability of generated docs", () => {
  it("parse(serialize(d)) ≡ d (modulo fidelity attrs)", () => {
    fc.assert(
      fc.property(generatedDoc, (docIn) => {
        const latex = serializeDoc(docIn);
        const { doc: docOut } = parseLatex(latex);
        expect(normalizeDoc(docOut)).toEqual(normalizeDoc(docIn));
        // And serialization of the reparsed doc is stable too.
        expect(serializeDoc(docOut)).toBe(latex);
      }),
      { numRuns: 200 },
    );
  });
});
