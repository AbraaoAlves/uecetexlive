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
import { ABNT_CITATION_PROFILE, type CitationProfile } from "./citation-profile";
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
      if (raw != null) return raw;
      const cmd = (node.attrs?.cmd as string) ?? "cite";
      const keys = (node.attrs?.keys as string[]) ?? [];
      const opt = node.attrs?.opt as string | null | undefined;
      return `\\${cmd}${opt ? `[${opt}]` : ""}{${keys.join(",")}}`;
    }
    case "crossref": {
      if (raw != null) return raw;
      const cmd = (node.attrs?.cmd as string) ?? "ref";
      return `\\${cmd}{${(node.attrs?.target as string) ?? ""}}`;
    }
    case "mathInline": {
      if (raw != null) return raw;
      const tex = (node.attrs?.tex as string) ?? "";
      return node.attrs?.delim === "paren" ? `\\(${tex}\\)` : `$${tex}$`;
    }
    case "footnote": {
      if (raw != null) return raw;
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

function serializeListItem(item: PMNode, profile: CitationProfile): string {
  const parts = (item.content ?? []).map((block) =>
    block.type === "paragraph"
      ? serializeInlines(block.content)
      : serializeBlock(block, profile),
  );
  return `\\item ${parts.join("\n")}`;
}

export function serializeBlock(
  node: PMNode,
  profile: CitationProfile = ABNT_CITATION_PROFILE,
): string {
  const raw = node.attrs?.rawSource as string | undefined;
  if (raw != null) return raw;

  switch (node.type) {
    case "rawLatexBlock":
      // Raw bytes live as text content (never escaped) so ProseMirror can
      // edit them natively; legacy attr form tolerated.
      return node.content?.length
        ? node.content.map((n) => n.text ?? "").join("")
        : ((node.attrs?.latex as string) ?? "");
    case "heading": {
      const byLevel: Record<number, string> = {
        1: "chapter",
        2: "section",
        3: "subsection",
        4: "subsubsection",
      };
      const cmd =
        (node.attrs?.cmd as string | null) ??
        byLevel[(node.attrs?.level as number) ?? 2] ??
        "section";
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
      const items = (node.content ?? [])
        .map((item) => serializeListItem(item, profile))
        .join("\n");
      return `\\begin{${env}}\n${items}\n\\end{${env}}`;
    }
    case "blockquote": {
      const env = (node.attrs?.env as string) ?? profile.longQuoteEnv;
      const inner = (node.content ?? [])
        .map((block) => serializeBlock(block, profile))
        .join("\n\n");
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
      const fonte = node.attrs?.fonte as string | null;
      const captionInner = `${label ? `\\label{${label}}` : ""}${escapeText(caption)}`;
      const graphics = `\\includegraphics${options ? `[${options}]` : ""}{${src}}`;
      return [
        `\\begin{figure}[${placement}]`,
        `\t\\centering`,
        `\t\\Caption{${captionInner}}`,
        `\t\\UECEfig{}{`,
        `\t\t\\fbox{${graphics}}`,
        `\t}{`,
        ...(fonte === null ? [] : [`\t\t\\Fonte{${fonte}}`]),
        `\t}`,
        `\\end{figure}`,
      ].join("\n");
    }
    case "latexTable":
      // rawSource is the table's ground truth (parse caches it; the 3×3
      // scaffold inserts it pre-filled) — a rawSource-less table has no
      // recoverable content.
      return "";
    case "codeBlock": {
      const language = node.attrs?.language as string | null;
      const code = node.content?.length
        ? node.content.map((n) => n.text ?? "").join("")
        : ((node.attrs?.code as string) ?? "");
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

export function serializeDoc(
  doc: PMDoc,
  profile: CitationProfile = ABNT_CITATION_PROFILE,
): string {
  let content = doc.content ?? [];
  // The editor's TrailingNode keeps an empty paragraph at doc end; it has no
  // LaTeX meaning — drop it (and only it) on serialization.
  const last = content[content.length - 1];
  if (
    last &&
    last.type === "paragraph" &&
    (!last.content || last.content.length === 0) &&
    last.attrs?.gapBefore == null
  ) {
    content = content.slice(0, -1);
  }
  let out = "";
  content.forEach((node, index) => {
    let gap =
      (node.attrs?.gapBefore as string | undefined) ?? (index === 0 ? "" : DEFAULT_GAP);
    // gapBefore is positional bookkeeping: when a block stops being first
    // (something was inserted above it), its stale "" would glue it onto the
    // previous block (`\end{table}\chapter{…}`). Pathological sources that
    // really do glue blocks fall to the parser's Invariant #1 backstop.
    if (index > 0 && gap === "") gap = DEFAULT_GAP;
    out += gap + serializeBlock(node, profile);
  });
  out +=
    ((doc as unknown as { attrs?: Record<string, unknown> }).attrs?.gapAfter as
      | string
      | undefined) ?? "";
  return out;
}
