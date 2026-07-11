/**
 * Projeta o campo BibTeX `author` ("Sobrenome, Nome and Sobrenome2, Nome2")
 * para a lista (§5.9 UI_UX_PLAN: "Sobrenome, N."). Puramente de exibição —
 * o domínio (`@papyru/bibliography`) nunca reformata o campo em si.
 */
const MAX_AUTHORS_SHOWN = 3;

function formatOne(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const commaIdx = trimmed.indexOf(",");
  if (commaIdx !== -1) {
    const surname = trimmed.slice(0, commaIdx).trim();
    const rest = trimmed.slice(commaIdx + 1).trim();
    const initial = rest.charAt(0);
    return initial ? `${surname}, ${initial}.` : surname;
  }
  const parts = trimmed.split(/\s+/);
  const surname = parts.at(-1) ?? trimmed;
  const initial = parts[0]?.charAt(0);
  return initial && parts.length > 1 ? `${surname}, ${initial}.` : surname;
}

export function formatAuthorsList(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const authors = raw
    .split(/\s+and\s+/i)
    .map(formatOne)
    .filter(Boolean);
  if (authors.length === 0) return null;
  if (authors.length <= MAX_AUTHORS_SHOWN) return authors.join("; ");
  return `${authors.slice(0, MAX_AUTHORS_SHOWN).join("; ")} et al.`;
}
