/**
 * Integra a folha de aprovação assinada ao documento principal.
 *
 * Sem o PDF enviado, o uecetex2 monta a folha a partir dos dados da banca.
 * Quando o arquivo assinado existe, a mesma posição passa a incluir o PDF.
 * Removê-lo restaura a folha gerada, portanto o trabalho continua compilável.
 */

export const SIGNED_APPROVAL_PATH =
  "elementos-pre-textuais/folha-de-aprovacao-assinada.pdf";

const GENERATED_LINE = /^([ \t]*)\\imprimirfolhadeaprovacao[ \t]*$/m;
const SIGNED_LINE = new RegExp(
  `^([ \\t]*)\\\\includepdf\\[pages=-\\]\\{${SIGNED_APPROVAL_PATH.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  )}\\}[ \\t]*$`,
  "m",
);

/** Troca somente a linha da folha dentro do corpo do documento. */
export function applySignedApproval(source: string, signed: boolean): string {
  const bodyStart = source.indexOf("\\begin{document}");
  if (bodyStart === -1) return source;
  const bodyEnd = source.indexOf("\\end{document}", bodyStart);
  const end = bodyEnd === -1 ? source.length : bodyEnd;
  const body = source.slice(bodyStart, end);

  if (signed) {
    if (SIGNED_LINE.test(body)) return source;
    const next = body.replace(
      GENERATED_LINE,
      `$1\\includepdf[pages=-]{${SIGNED_APPROVAL_PATH}}`,
    );
    return next === body ? source : source.slice(0, bodyStart) + next + source.slice(end);
  }

  const next = body.replace(SIGNED_LINE, "$1\\imprimirfolhadeaprovacao");
  return next === body ? source : source.slice(0, bodyStart) + next + source.slice(end);
}
