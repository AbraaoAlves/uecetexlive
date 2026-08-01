import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProjectRail, type RailFile } from "./ProjectRail";

const files: RailFile[] = [
  { path: "documento.tex", dirty: false, locked: true },
  { path: "elementos-pre-textuais/resumo.tex", dirty: false, locked: false },
  { path: "elementos-pre-textuais/abstract.tex", dirty: false, locked: false },
  { path: "elementos-textuais/introducao.tex", dirty: false, locked: false },
  { path: "elementos-textuais/metodologia.tex", dirty: false, locked: false },
  { path: "elementos-textuais/conclusao.tex", dirty: false, locked: false },
  { path: "elementos-pos-textuais/glossario.tex", dirty: false, locked: false },
  { path: "elementos-pos-textuais/referencias.bib", dirty: false, locked: false },
  { path: "lib/uecetex2.sty", dirty: false, locked: true },
  { path: "lib/preambulo.tex", dirty: false, locked: true },
  { path: "figuras/figura-1.jpg", dirty: false, locked: false },
  { path: "figuras/main.cpp", dirty: false, locked: false },
];

const meta = {
  title: "Shell/ProjectRail",
  component: ProjectRail,
  args: {
    files,
    currentPath: "elementos-textuais/introducao.tex",
    missingIncludes: [],
    onSelect: () => {},
  },
} satisfies Meta<typeof ProjectRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullTree: Story = {};

export const DirtyFiles: Story = {
  args: {
    files: files.map((f) =>
      f.path.startsWith("elementos-textuais/") ? { ...f, dirty: true } : f,
    ),
  },
};

export const MissingInclude: Story = {
  args: {
    missingIncludes: ["elementos-textuais/capitulo-novo"],
  },
};

export const LockedLib: Story = {
  args: {
    currentPath: "lib/uecetex2.sty",
  },
};

/** Elementos opcionais: um incluído, um fora do PDF, o resto sem controle. */
export const OptionalElements: Story = {
  args: {
    files: [
      {
        path: "elementos-pre-textuais/agradecimentos.tex",
        dirty: false,
        locked: false,
        toggle: { macro: "imprimiragradecimentos", enabled: true },
      },
      {
        path: "elementos-pre-textuais/dedicatoria.tex",
        dirty: false,
        locked: false,
        toggle: { macro: "imprimirdedicatoria", enabled: false },
      },
      { path: "elementos-pre-textuais/resumo.tex", dirty: false, locked: false },
      {
        path: "elementos-pos-textuais/glossario.tex",
        dirty: true,
        locked: false,
        toggle: { macro: "imprimirglossario", enabled: false },
      },
    ],
    currentPath: "elementos-pre-textuais/resumo.tex",
    onToggleImprimir: () => {},
  },
};
