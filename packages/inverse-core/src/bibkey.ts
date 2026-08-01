/**
 * Chaves BibTeX das entradas reconstruídas.
 *
 * Vive num módulo próprio porque é a fonte de verdade compartilhada entre o
 * emissor do `.bib` e o índice de citações: os dois precisam produzir
 * exatamente a mesma chave, na mesma ordem, ou um `\cite` apontaria para uma
 * entrada que não existe.
 */
import type { BibEntry } from "./semantic.js";
import { slug } from "./text-util.js";

function bibKey(e: BibEntry, used: Set<string>): string {
  // Hífen e apóstrofo fazem parte do sobrenome ("GARCÍA-MATEOS", "D'ÁVILA"),
  // e a inicial pode ser qualquer maiúscula Unicode ("ŠVIČEVIĆ") — com as
  // classes ASCII+Latin-1 antigas a entrada inteira caía no fallback "ref".
  const surname = /^(\p{Lu}[\p{L}\p{M}' -]+?)[,.]/u.exec(e.raw)?.[1] ?? "ref";
  const year = /\b(1[89]\d\d|20\d\d)\b/.exec(e.raw)?.[1] ?? "s.d";
  let key = slug(surname).replace(/-/g, "") + year.replace(".", "");
  while (used.has(key)) key += "x";
  used.add(key);
  return key;
}

export function bibKeys(entries: BibEntry[]): string[] {
  const used = new Set<string>();
  return entries.map((e) => bibKey(e, used));
}
