/**
 * Folha de aprovação — reparo do campo vazio que impede o PDF de sair.
 *
 * Na variante de TCC de graduação/especialização (`\imprimirfolhadeaprovacaotcc`,
 * lib/uecetex2.sty) cada assinatura é montada juntando três partes com `\\`:
 *
 *     \assinatura{\imprimirmembrodabancadois \\ …doiscentro \\ …doisies}
 *
 * Quando a parte do meio está vazia sobram dois `\\` seguidos; o segundo cai em
 * modo vertical e o LaTeX aborta com "There's no line here to end". O motor
 * Rascunho não devolve PDF nenhum nesse caso. As variantes de dissertação e
 * tese juntam só duas partes e não têm o problema.
 *
 * O reparo grava `\mbox{}` — "vazio, porém em modo horizontal" — no campo em
 * falta. Um valor invisível resolve; `\null` NÃO resolve (é `\hbox{}` sem
 * `\leavevmode`, então não sai do modo vertical). Nenhum dado é inventado: o
 * nome e a instituição digitados pelo autor ficam onde estão, e o wizard
 * mostra o campo como vazio (ver `isEmptySlotFiller`).
 */

import {
  applyMetadata,
  extractMetadata,
  type MetadataField,
  workTypeOf,
} from "./metadata";

/** Valor gravado num campo vazio que o modelo não pode deixar em branco. */
export const EMPTY_SLOT_FILLER = "\\mbox{}";

export interface SignatureSlot {
  /** Macro do nome; vazia significa assinatura não impressa. */
  nameMacro: string;
  /** Macro do centro/faculdade — a parte do meio da assinatura. */
  centroMacro: string;
  /**
   * O modelo envolve a assinatura em `\ifnotempty{<nome>}`? Quando não
   * envolve (orientador), a assinatura sai mesmo com o nome vazio.
   */
  onlyWhenNamed: boolean;
}

/** Assinaturas que a folha de TCC imprime, na ordem do modelo. */
export const SIGNATURE_SLOTS: readonly SignatureSlot[] = [
  { nameMacro: "orientador", centroMacro: "orientadorcentro", onlyWhenNamed: false },
  { nameMacro: "coorientador", centroMacro: "coorientadorcentro", onlyWhenNamed: true },
  ...(["dois", "tres", "quatro"] as const).map((slot) => ({
    nameMacro: `membrodabanca${slot}`,
    centroMacro: `membrodabanca${slot}centro`,
    onlyWhenNamed: true,
  })),
];

/** `true` quando o valor é o preenchimento do app, não texto do autor. */
export function isEmptySlotFiller(value: string): boolean {
  return value.trim() === EMPTY_SLOT_FILLER;
}

/**
 * O wizard mostra o preenchimento do app como campo vazio — que é a verdade
 * sobre o dado. Se o autor digitar algo, substitui; se deixar em branco, o
 * reparo volta a gravar o preenchimento.
 */
export function withHiddenSlotFillers(
  fields: ReadonlyMap<string, MetadataField>,
): Map<string, MetadataField> {
  const out = new Map(fields);
  for (const slot of SIGNATURE_SLOTS) {
    const field = out.get(slot.centroMacro);
    if (field && isEmptySlotFiller(field.value)) {
      out.set(slot.centroMacro, { ...field, value: "" });
    }
  }
  return out;
}

/**
 * Preenche os campos vazios que quebrariam a folha de aprovação.
 * Devolve `null` quando não há nada a corrigir — mesma forma de
 * `normalizeResumoSource`, para o chamador não regravar o arquivo à toa.
 */
export function repairFolhaAprovacao(source: string): string | null {
  const fields = extractMetadata(source);
  // \imprimirfolhadeaprovacao cai no ramo de TCC sempre que o tipo não é
  // dissertação nem tese — inclusive quando \trabalhoacademico está ausente
  // ou tem valor desconhecido.
  const workType = workTypeOf(fields);
  if (workType === "dissertacao" || workType === "tese") return null;

  const updates = new Map<string, string>();
  for (const slot of SIGNATURE_SLOTS) {
    // Campo ausente do documento não é reparável — nunca inventar a linha.
    if (fields.get(slot.centroMacro)?.value.trim() !== "") continue;
    if (slot.onlyWhenNamed && (fields.get(slot.nameMacro)?.value.trim() ?? "") === "") {
      continue;
    }
    updates.set(slot.centroMacro, EMPTY_SLOT_FILLER);
  }
  if (updates.size === 0) return null;
  return applyMetadata(source, updates);
}
