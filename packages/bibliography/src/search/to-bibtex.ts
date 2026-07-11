/**
 * candidate → NewEntryInput, com o `escapeBibtex` corrigido (§5.8 item 1):
 * o gist original fazia `.replace(/[{}]/g, '')`, destruindo proteção de
 * maiúsculas (`{BERT}` virava `bert`). Aqui as chaves balanceadas são
 * preservadas; só os caracteres especiais do LaTeX fora delas são escapados.
 */
import { buildCitationKey } from "../domain/citation-key";
import type { NewEntryInput } from "../domain/types";
import type { ReferenceCandidate } from "./types";

const SPECIAL_CHARS = /[&%#_~]/;

export function escapeBibtex(text: string): string {
  let depth = 0;
  let out = "";
  for (const ch of text) {
    if (ch === "{") {
      depth++;
      out += ch;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
      out += ch;
    } else if (depth === 0 && SPECIAL_CHARS.test(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return out;
}

function serializeCandidateAuthors(candidate: ReferenceCandidate): string {
  return candidate.authors
    .filter((a) => a.lastName.trim())
    .map((a) => (a.firstName.trim() ? `${a.lastName}, ${a.firstName}` : a.lastName))
    .join(" and ");
}

export function candidateToNewEntryInput(candidate: ReferenceCandidate): NewEntryInput {
  const fields = new Map<string, string>();
  const authors = serializeCandidateAuthors(candidate);
  if (authors) fields.set("author", escapeBibtex(authors));
  fields.set("title", escapeBibtex(candidate.title));
  if (candidate.year) fields.set("year", candidate.year);
  if (candidate.venue) {
    const venueField = candidate.entryType === "inproceedings" ? "booktitle" : "journal";
    fields.set(venueField, escapeBibtex(candidate.venue));
  }
  if (candidate.doi) fields.set("doi", candidate.doi);
  if (candidate.url) fields.set("url", candidate.url);

  const citationKey = buildCitationKey({
    authorSurname: candidate.authors[0]?.lastName,
    year: candidate.year ?? undefined,
    title: candidate.title,
  });

  return { citationKey, entryType: candidate.entryType, fields };
}
