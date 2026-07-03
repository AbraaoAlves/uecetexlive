import type { Meta, StoryObj } from "@storybook/react-vite";
import { ImportDialog } from "./ImportDialog";

const meta = {
  title: "Shell/ImportDialog",
  component: ImportDialog,
  args: { onConfirm: () => {}, onClose: () => {} },
} satisfies Meta<typeof ImportDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ZipOk: Story = {
  args: {
    state: { kind: "zip-ok", fileCount: 37, entry: "documento.tex" },
  },
};

export const ZipInvalid: Story = {
  args: {
    state: { kind: "zip-error", message: "O ZIP não contém nenhum arquivo .tex" },
  },
};

export const BblImport: Story = {
  args: {
    state: { kind: "bbl-ok", sizeBytes: 4321 },
  },
};
