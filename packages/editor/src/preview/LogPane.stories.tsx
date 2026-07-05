import type { Meta, StoryObj } from "@storybook/react-vite";
import { LogPane } from "./LogPane";

const meta = {
  title: "Preview/LogPane",
  component: LogPane,
} satisfies Meta<typeof LogPane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CleanLog: Story = {
  args: {
    log: "$ pdflatex documento.tex (exit 0)\nOutput written on documento.pdf (51 pages).",
    diagnostics: [],
    draftMode: false,
  },
};

export const WithDiagnostics: Story = {
  args: {
    log: "./elementos-textuais/introducao.tex:42: Undefined control sequence.",
    diagnostics: [
      {
        severity: "error",
        file: "elementos-textuais/introducao.tex",
        line: 42,
        message: "Undefined control sequence.",
        rawLogExcerpt: "l.42 \\badmacro",
      },
      {
        severity: "warning",
        message: "Citation `alves2010' undefined",
        rawLogExcerpt: "LaTeX Warning",
      },
    ],
    draftMode: false,
  },
};

export const DraftModeNotice: Story = {
  args: {
    log: "Output written on documento.pdf.",
    diagnostics: [],
    draftMode: true,
  },
};
