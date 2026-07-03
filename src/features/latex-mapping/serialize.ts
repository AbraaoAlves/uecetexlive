/**
 * PM-JSON → LaTeX (§4.3).
 *
 * Fidelity rules:
 *  - Nodes carrying `rawSource` (captured at parse time) emit it verbatim —
 *    the editor clears rawSource when a node's content is edited.
 *  - `gapBefore` holds the literal inter-block whitespace slice; generated
 *    blocks default to one blank line.
 *  - rawLatex nodes emit their stored text byte-for-byte.
 */
import type { PMDoc, PMMark, PMNode } from "./types";

const DEFAULT_GAP = "\n\n";

/** Text escaping — mirrors the escape-macro set recognized by the parser. */
const ESCAPES: Record<string, string> = {
  "%": "\\%",
  "&": "\\&",
  "#": "\\#",
  _: "\\_",
  $: "\\$",
  "{": "\\{",
  "}": "\\}",
};

export function escapeText(text: string): string {
  return text.replace(/[%&#_${}]/g, (ch) => ESCAPES[ch] ?? ch);
}

const MARK_CMD_DEFAULT: Record<string, string> = {
  bold: "textbf",
  italic: "textit",
  underline: "underline",
  code: "texttt",
};

function wrapMarks(inner: string, marks: PMMark[] | undefined): string {
  if (!marks?.length) return inner;
  let out = inner;
  for (let i = marks.length - 1; i >= 0; i--) {
    const mark = marks[i];
    if (!mark) continue;
    const cmd = (mark.attrs?.cmd as string) ?? MARK_CMD_DEFAULT[mark.type] ?? mark.type;
    out = `\\${cmd}{${out}}`;
  }
  return out;
}

export function serializeInline(node: PMNode): string {
  const raw = node.attrs?.rawSource as string | undefined;
  switch (node.type) {
    case "text":
      return wrapMarks(escapeText(node.text ?? ""), node.marks);
    case "citation": {
      if (raw !== undefined) return raw;
      const cmd = (node.attrs?.cmd as string) ?? "cite";
      const keys = (node.attrs?.keys as string[]) ?? [];
      const opt = node.attrs?.opt as string | null | undefined;
      return `\\${cmd}${opt ? `[${opt}]` : ""}{${keys.join(",")}}`;
    }
    case "crossref": {
      if (raw !== undefined) return raw;
      const cmd = (node.attrs?.cmd as string) ?? "ref";
      return `\\${cmd}{${(node.attrs?.target as string) ?? ""}}`;
    }
    case "mathInline": {
      if (raw !== undefined) return raw;
      const tex = (node.attrs?.tex as string) ?? "";
      return node.attrs?.delim === "paren" ? `\\(${tex}\\)` : `$${tex}$`;
    }
    case "footnote": {
      if (raw !== undefined) return raw;
      return `\\footnote{${(node.attrs?.latex as string) ?? ""}}`;
    }
    case "rawLatexInline":
      return (node.attrs?.latex as string) ?? "";
    default:
      return raw ?? "";
  }
}

function serializeInlines(content: PMNode[] | undefined): string {
  return (content ?? []).map(serializeInline).join("");
}

function serializeListItem(item: PMNode): string {
  const parts = (item.content ?? []).map((block) =>
    block.type === "paragraph" ? serializeInlines(block.content) : serializeBlock(block),
  );
  return `\\item ${parts.join("\n")}`;
}

export function serializeBlock(node: PMNode): string {
  const raw = node.attrs?.rawSource as string | undefined;
  if (raw !== undefined) return raw;

  switch (node.type) {
    case "rawLatexBlock":
      return (node.attrs?.latex as string) ?? "";
    case "heading": {
      const cmd = (node.attrs?.cmd as string) ?? "section";
      const star = node.attrs?.starred ? "*" : "";
      return `\\${cmd}${star}{${serializeInlines(node.content)}}`;
    }
    case "paragraph":
      return serializeInlines(node.content);
    case "latexComment":
      return `%${(node.attrs?.text as string) ?? ""}`;
    case "bulletList":
    case "orderedList": {
      const env = node.type === "bulletList" ? "itemize" : "enumerate";
      const items = (node.content ?? []).map(serializeListItem).join("\n");
      return `\\begin{${env}}\n${items}\n\\end{${env}}`;
    }
    case "blockquote": {
      const env = (node.attrs?.env as string) ?? "citacao";
      const inner = (node.content ?? []).map(serializeBlock).join("\n\n");
      return `\\begin{${env}}\n${inner}\n\\end{${env}}`;
    }
    case "mathBlock": {
      const tex = (node.attrs?.tex as string) ?? "";
      const env = (node.attrs?.env as string) ?? "display";
      return env === "display"
        ? `\\[\n${tex}\n\\]`
        : `\\begin{${env}}\n${tex}\n\\end{${env}}`;
    }
    case "latexFigure": {
      const placement = (node.attrs?.placement as string) || "htb";
      const options = node.attrs?.options as string | null;
      const src = (node.attrs?.src as string) ?? "";
      const caption = (node.attrs?.caption as string) ?? "";
      const label = node.attrs?.label as string | null;
      const captionInner = `${label ? `\\label{${label}}` : ""}${escapeText(caption)}`;
      return [
        `\\begin{figure}[${placement}]`,
        `\t\\centering`,
        `\t\\caption{${captionInner}}`,
        `\t\\includegraphics${options ? `[${options}]` : ""}{${src}}`,
        `\\end{figure}`,
      ].join("\n");
    }
    case "latexTable":
      // Read-only projection (§4.2): parse always caches rawSource; a
      // rawSource-less table only exists via the 3×3 scaffold which builds
      // a rawLatexBlock instead.
      return "";
    case "codeBlock": {
      const language = node.attrs?.language as string | null;
      const code = (node.attrs?.code as string) ?? "";
      return `\\begin{lstlisting}${language ? `[language=${language}]` : ""}\n${code}\n\\end{lstlisting}`;
    }
    case "codeInclude": {
      const options = node.attrs?.options as string | null;
      const file = (node.attrs?.file as string) ?? "";
      return `\\lstinputlisting${options ? `[${options}]` : ""}{${file}}`;
    }
    default:
      return (node.attrs?.latex as string) ?? "";
  }
}

export function serializeDoc(doc: PMDoc): string {
  const content = doc.content ?? [];
  let out = "";
  content.forEach((node, index) => {
    const gap =
      (node.attrs?.gapBefore as string | undefined) ?? (index === 0 ? "" : DEFAULT_GAP);
    out += gap + serializeBlock(node);
  });
  out +=
    ((doc as unknown as { attrs?: Record<string, unknown> }).attrs?.gapAfter as
      | string
      | undefined) ?? "";
  return out;
}
