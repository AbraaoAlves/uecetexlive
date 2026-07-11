/**
 * Serializa a lista de autores do formulário (§5.9: pares Nome/Sobrenome,
 * "o usuário nunca digita 'and'") para o campo BibTeX `author`.
 */
export interface AuthorInput {
  readonly firstName: string;
  readonly lastName: string;
}

export function serializeAuthors(authors: readonly AuthorInput[]): string {
  return authors
    .filter((a) => a.firstName.trim() || a.lastName.trim())
    .map((a) =>
      `${a.lastName.trim()}, ${a.firstName.trim()}`.replace(/^, /, "").replace(/, $/, ""),
    )
    .join(" and ");
}

export function emptyAuthor(): AuthorInput {
  return { firstName: "", lastName: "" };
}

/** Inverse of serializeAuthors — pre-fills the edit form (B2) from an existing `author` field. */
export function parseAuthors(raw: string | undefined): AuthorInput[] {
  const trimmed = raw?.trim();
  if (!trimmed) return [emptyAuthor()];
  const authors = trimmed.split(/\s+and\s+/i).map((segment): AuthorInput => {
    const commaIdx = segment.indexOf(",");
    if (commaIdx === -1) return { firstName: "", lastName: segment.trim() };
    return {
      lastName: segment.slice(0, commaIdx).trim(),
      firstName: segment.slice(commaIdx + 1).trim(),
    };
  });
  return authors.length > 0 ? authors : [emptyAuthor()];
}
