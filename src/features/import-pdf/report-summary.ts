/**
 * O relatório do emissor em linguagem de gente.
 *
 * O aluno não precisa saber o que é um "nó não classificado"; precisa saber
 * quantos capítulos vieram e o que vai ter de refazer à mão. As contagens em
 * zero somem — listar "0 quadros" só faz barulho.
 */
import type { EmitReport } from "@papyru/inverse-core";
import { strings } from "@/lib/strings";

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

/** Linhas do "o que reconhecemos". */
export function reportCounts(report: EmitReport): string[] {
  const counts: [number, string, string][] = [
    [report.chapters, "capítulo", "capítulos"],
    [report.figures, "figura", "figuras"],
    [report.tables, "tabela ou quadro", "tabelas e quadros"],
    [report.codeBlocks, "trecho de código", "trechos de código"],
    [report.bibEntries, "referência", "referências"],
    [report.citations.linked, "citação ligada", "citações ligadas"],
  ];
  return counts.filter(([n]) => n > 0).map(([n, um, muitos]) => plural(n, um, muitos));
}

const PENDENCY_LABEL: Record<string, { one: string; many: string }> =
  strings.importPdf.pendencyLabels;

export function pendencyLabelFor(kind: string): string {
  return PENDENCY_LABEL[kind]?.one ?? kind;
}

/** Linhas do "o que vai precisar da sua mão", da mais frequente à menos. */
export function reportPendencies(report: EmitReport): string[] {
  const byKind = new Map<string, number>();
  for (const p of report.pendencias) {
    byKind.set(p.kind, (byKind.get(p.kind) ?? 0) + 1);
  }
  return [...byKind.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([kind, n]) => {
      const label = PENDENCY_LABEL[kind];
      return label ? plural(n, label.one, label.many) : `${n} ${kind}`;
    });
}
