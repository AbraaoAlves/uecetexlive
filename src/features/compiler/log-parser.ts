/**
 * pdfTeX log parser (§4.7) — pure, never throws on garbage input.
 *
 * Two error shapes are handled:
 *  1. `-file-line-error` mode: `./path/file.tex:42: message` (full builds —
 *     our orchestrator always passes the flag).
 *  2. Classic mode: `! message` followed by `l.42 …` (draft engine); the
 *     source file is inferred from the open-file paren stack, best-effort.
 */
import type { CompileDiagnostic } from "./types";

export interface ParsedLog {
  diagnostics: CompileDiagnostic[];
  needsRerun: boolean;
  citationsUndefined: boolean;
  missingFiles: string[];
}

const FILE_LINE_ERROR = /^(.+?\.\w+):(\d+): (.*)$/;
const CLASSIC_ERROR = /^! (.*)$/;
const LINE_MARKER = /^l\.(\d+)/;
const MISSING_FILE = /File `([^']+)' not found/;
const CITATION_WARNING = /^LaTeX Warning: (Citation `[^']*' .*undefined.*)$/i;
const GENERIC_WARNING = /^(?:LaTeX|Package|Class)(?: \w+)? Warning: (.*)$/;
const RERUN = /Rerun to get|Rerun LaTeX|rerun LaTeX/;

function normalizePath(raw: string): string {
  return raw.replace(/^\.\//, "");
}

/** Track pdfTeX's open-file parens: `(./file.tex` pushes, `)` pops. */
function updateParenStack(stack: string[], line: string): void {
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === "(") {
      const rest = line.slice(i + 1);
      const match = rest.match(/^([^\s()]+\.[A-Za-z0-9]+)/);
      if (match?.[1]) {
        stack.push(normalizePath(match[1]));
        i += 1 + match[1].length;
        continue;
      }
      stack.push(""); // anonymous group
    } else if (ch === ")") {
      stack.pop();
    }
    i += 1;
  }
}

function currentFile(stack: string[]): string | undefined {
  for (let i = stack.length - 1; i >= 0; i--) {
    const item = stack[i];
    if (item) return item;
  }
  return undefined;
}

export function parseLatexLog(log: string): ParsedLog {
  const diagnostics: CompileDiagnostic[] = [];
  const missingFiles: string[] = [];
  let needsRerun = false;
  let citationsUndefined = false;

  const lines = log.split("\n");
  const parenStack: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    if (RERUN.test(line)) needsRerun = true;

    const fle = line.match(FILE_LINE_ERROR);
    if (fle?.[1] && fle[2] && fle[3] !== undefined) {
      const missing = fle[3].match(MISSING_FILE);
      if (missing?.[1]) missingFiles.push(missing[1]);
      diagnostics.push({
        severity: "error",
        file: normalizePath(fle[1]),
        line: Number(fle[2]),
        message: fle[3].replace(/^LaTeX Error: /, "").trim(),
        rawLogExcerpt: lines.slice(i, i + 4).join("\n"),
      });
      continue;
    }

    const classic = line.match(CLASSIC_ERROR);
    if (classic?.[1] && !classic[1].startsWith(" ==>")) {
      const missing = classic[1].match(MISSING_FILE);
      if (missing?.[1]) missingFiles.push(missing[1]);
      // Look ahead for the `l.N` marker within the error block.
      let errorLine: number | undefined;
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const marker = (lines[j] ?? "").match(LINE_MARKER);
        if (marker?.[1]) {
          errorLine = Number(marker[1]);
          break;
        }
      }
      diagnostics.push({
        severity: "error",
        file: currentFile(parenStack),
        line: errorLine,
        message: classic[1].replace(/^LaTeX Error: /, "").trim(),
        rawLogExcerpt: lines.slice(i, i + 4).join("\n"),
      });
      continue;
    }

    const citation = line.match(CITATION_WARNING);
    if (citation?.[1]) {
      citationsUndefined = true;
      diagnostics.push({
        severity: "warning",
        message: citation[1].trim(),
        rawLogExcerpt: line,
      });
      continue;
    }

    const warning = line.match(GENERIC_WARNING);
    if (warning?.[1] && !RERUN.test(line) && !/undefined references/i.test(line)) {
      diagnostics.push({
        severity: "warning",
        message: warning[1].trim(),
        rawLogExcerpt: line,
      });
      continue;
    }

    updateParenStack(parenStack, line);
  }

  return { diagnostics, needsRerun, citationsUndefined, missingFiles };
}
