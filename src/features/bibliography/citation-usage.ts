/**
 * Conta usos de uma citation key nos .tex do projeto (B2 — avisar antes de
 * remover). Projeto-level de propósito: precisa varrer todos os arquivos
 * .tex, não só o .bib, então não pertence ao domínio de @papyru/bibliography
 * (mesma fronteira de contexto que renameKey já respeita, §5.5).
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches \cmd{key1,key2} and \cmd[opt]{key1,key2} for any given command name. */
function citationRegex(citeCommands: readonly string[]): RegExp {
  const cmdAlternation = citeCommands.map(escapeRegExp).join("|");
  return new RegExp(`\\\\(?:${cmdAlternation})(?:\\[[^\\]]*\\])?\\{([^}]*)\\}`, "g");
}

export function countCitationUsages(
  texSources: Record<string, string>,
  key: string,
  citeCommands: readonly string[],
): number {
  const re = citationRegex(citeCommands);
  let count = 0;
  for (const source of Object.values(texSources)) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null = re.exec(source);
    while (match !== null) {
      const keys = (match[1] ?? "").split(",").map((k) => k.trim());
      if (keys.includes(key)) count++;
      match = re.exec(source);
    }
  }
  return count;
}

/** Every citation key invoked anywhere in the project (3.2 — citações órfãs / nunca citadas). */
export function extractCitedKeys(
  texSources: Record<string, string>,
  citeCommands: readonly string[],
): Set<string> {
  const re = citationRegex(citeCommands);
  const keys = new Set<string>();
  for (const source of Object.values(texSources)) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null = re.exec(source);
    while (match !== null) {
      for (const key of (match[1] ?? "").split(",").map((k) => k.trim())) {
        if (key) keys.add(key);
      }
      match = re.exec(source);
    }
  }
  return keys;
}
