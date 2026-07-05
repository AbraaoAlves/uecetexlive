import type { Meta, StoryObj } from "@storybook/react-vite";
import type { MetadataField } from "@/features/project/metadata";
import { MetadataWizard } from "./MetadataWizard";

/** Build a fields map; offsets are irrelevant for the view. */
function fields(entries: Record<string, string>): Map<string, MetadataField> {
  const map = new Map<string, MetadataField>();
  for (const [macro, value] of Object.entries(entries)) {
    map.set(macro, { macro, value, start: 0, end: 0 });
  }
  return map;
}

const GRAD = fields({
  titulo: "Jogos Digitais no Ensino de Programação",
  autor: "Maria da Silva",
  trabalhoacademico: "tccgraduacao",
  ehuab: "sim",
  localdopolo: "Limoeiro do Norte -- Ceará",
  graduacaoem: "Licenciatura em Computação",
  habilitacao: "Licenciado em Computação",
  orientador: "Prof. Dr. João Souza",
  ies: "Universidade Estadual do Ceará",
  iessigla: "UECE",
  data: "2026",
  local: "Fortaleza",
});

const meta = {
  title: "Metadata/MetadataWizard",
  component: MetadataWizard,
  decorators: [
    (Story) => (
      <div className="flex h-[34rem] w-full flex-col border">
        <Story />
      </div>
    ),
  ],
  args: {
    onApply: () => {},
    onClose: () => {},
  },
} satisfies Meta<typeof MetadataWizard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewTemplate: Story = {
  args: {
    fields: fields({
      titulo: "Título do Trabalho",
      trabalhoacademico: "tccgraduacao",
    }),
  },
};

export const FilledGraduacao: Story = {
  args: { fields: GRAD },
};

export const MissingMacros: Story = {
  // Empty map: every field renders disabled with the "não encontrado" hint.
  args: { fields: fields({}) },
};
