/**
 * Protocolo entre a tela de importação e o worker que roda o pipeline
 * PDF → projeto. Fica num módulo próprio para que os dois lados compartilhem
 * os tipos sem que a tela arraste o worker (e o WASM) para o bundle inicial.
 */
import type { EmitReport } from "@papyru/inverse-core";

export interface ImportPdfRequest {
  pdf: Uint8Array;
  /** Esqueleto do modelo: caminho relativo → bytes. */
  template: [string, Uint8Array][];
  /** Seguir mesmo com o PDF fora do perfil do modelo. */
  force?: boolean;
}

export type ImportStage = "lendo" | "reconhecendo" | "montando";

export type ImportPdfMessage =
  | { type: "progress"; stage: ImportStage; pct: number }
  | { type: "done"; files: [string, Uint8Array][]; report: EmitReport }
  | { type: "error"; message: string }
  /** O PDF não parece do modelo — o aluno decide se insiste. */
  | { type: "low-confidence"; bodyFraction: number; hasOutline: boolean };
