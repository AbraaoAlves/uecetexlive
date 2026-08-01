import type { EmitReport } from "@papyru/inverse-core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ImportPdfDialog } from "./ImportPdfDialog";

const report: EmitReport = {
  chapters: 7,
  figures: 6,
  tables: 1,
  listItems: 24,
  codeBlocks: 0,
  bibEntries: 49,
  citations: { linked: 40, literal: 17 },
  pretextuais: ["RESUMO", "ABSTRACT", "AGRADECIMENTOS"],
  pendencias: [
    { kind: "citacao-nao-ligada", page: 12, excerpt: "Conforme (Desconhecido, 2011)…" },
    { kind: "citacao-nao-ligada", page: 18, excerpt: "Vários (Fulano, 1999)…" },
    { kind: "equacao", page: 26, excerpt: "x = a0 + 1/(a1 + …)" },
    { kind: "nota-rodape", page: 28, excerpt: "Use notas de rodapé para…" },
  ],
};

const meta = {
  title: "ImportPdf/ImportPdfDialog",
  component: ImportPdfDialog,
  parameters: { layout: "fullscreen" },
  args: { onConfirm: () => {}, onClose: () => {} },
} satisfies Meta<typeof ImportPdfDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Lendo: Story = {
  args: { state: { kind: "running", stage: "lendo", pct: 0 } },
};

export const Reconhecendo: Story = {
  args: { state: { kind: "running", stage: "reconhecendo", pct: 0.45 } },
};

export const Relatorio: Story = {
  args: { state: { kind: "report", report, fileCount: 42 } },
};

export const RelatorioSemPendencias: Story = {
  args: {
    state: { kind: "report", report: { ...report, pendencias: [] }, fileCount: 29 },
  },
};

export const Erro: Story = {
  args: {
    state: {
      kind: "error",
      message:
        "Este PDF não parece ter sido gerado pelo modelo da UECE. A importação funciona bem apenas para PDFs desse modelo.",
    },
  },
};
