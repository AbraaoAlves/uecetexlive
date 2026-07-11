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
