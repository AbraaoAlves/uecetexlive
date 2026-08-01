/**
 * O PDF parece ter saído do modelo da UECE?
 *
 * O reconhecimento se apoia na assinatura tipográfica do abnTeX2: o corpo do
 * texto em Nimbus Roman e um sumário navegável. Um PDF de outra origem passa
 * pelo pipeline sem erro e produz um projeto ruim — pior do que recusar, que é
 * o motivo de a checagem existir antes do classificador.
 *
 * "Tentar mesmo assim" continua disponível: a heurística erra, e o aluno é
 * quem sabe de onde veio o arquivo dele.
 */
import type { DocumentIR } from "@papyru/inverse-core";

/** Fonte de corpo que o modelo usa (mesma regex do classificador). */
const BODY_FONT = /^NimbusRomNo9L/;

/** Abaixo disso, o reconhecimento não se sustenta. */
const MIN_BODY_FRACTION = 0.5;

export interface Confidence {
  ok: boolean;
  /** Fração dos caracteres em fontes do corpo do modelo. */
  bodyFraction: number;
  hasOutline: boolean;
}

export function assessConfidence(ir: DocumentIR): Confidence {
  const total = ir.fonts.reduce((sum, f) => sum + f.chars, 0);
  const body = ir.fonts
    .filter((f) => BODY_FONT.test(f.font))
    .reduce((sum, f) => sum + f.chars, 0);
  const bodyFraction = total > 0 ? body / total : 0;
  const hasOutline = (ir.outline?.length ?? 0) > 0;
  return {
    ok: hasOutline && bodyFraction >= MIN_BODY_FRACTION,
    bodyFraction,
    hasOutline,
  };
}
