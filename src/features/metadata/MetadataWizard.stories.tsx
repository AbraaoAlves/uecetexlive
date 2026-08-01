import type { Meta, StoryObj } from "@storybook/react-vite";
import type { MetadataField } from "@/features/project/metadata";
import { WIZARD_STEPS } from "./fields";
import { MetadataWizard } from "./MetadataWizard";

/** Build a fields map; offsets are irrelevant for the view. */
function fields(entries: Record<string, string>): Map<string, MetadataField> {
  const map = new Map<string, MetadataField>();
  for (const [macro, value] of Object.entries(entries)) {
    map.set(macro, { macro, value, start: 0, end: 0 });
  }
  return map;
}

/** Banca preenchida — sem nome, os slots seguintes nem aparecem. */
const BANCA = {
  membrodabancadois: "Profa. Dra. Ana Paula Tahim",
  membrodabancadoisies: "Universidade Aberta do Brasil",
  membrodabancadoiscentro: "Centro de Ciências e Tecnologia",
  membrodabancatres: "Prof. Me. Francisco Forte",
  membrodabancatresies: "Universidade Aberta do Brasil",
  membrodabancatrescentro: "Centro de Ciências e Tecnologia",
};

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
  dataaprovacao: "",
  orientadories: "Universidade Estadual do Ceará",
  orientadorcentro: "Centro de Ciências e Tecnologia",
  orientadorfeminino: "nao",
  coorientador: "",
  coorientadorfeminino: "nao",
  coorientadories: "",
  coorientadorcentro: "",
  centro: "Centro de Ciências e Tecnologia",
  resumobody: "Este trabalho investiga o uso de jogos digitais no ensino.",
  palavraschave: "jogos digitais; ensino; programação.",
  abstractbody: "This work investigates the use of digital games in teaching.",
  keywords: "digital games; teaching; programming.",
  ...BANCA,
});

const meta = {
  title: "Metadata/MetadataWizard",
  component: MetadataWizard,
  decorators: [
    (Story) => (
      // Altura do alvo de leitura da Fase 1: 1366x768.
      <div className="flex h-[768px] w-full flex-col border">
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

// Uma story por etapa: com o projeto preenchido, nenhuma delas deve rolar na
// altura de 768 px do decorator. Os índices seguem WIZARD_STEPS.
const stepAt = (id: string): Story => ({
  args: {
    fields: GRAD,
    initialStep: WIZARD_STEPS.findIndex((step) => step.id === id),
  },
});

export const StepTitulo = stepAt("titulo");
export const StepTipo = stepAt("tipo");
export const StepAutor = stepAt("autor");
export const StepOrientacao = stepAt("orientacao");
export const StepDataLocal = stepAt("datalocal");
export const StepBanca = stepAt("banca");
export const StepResumo = stepAt("resumo");
export const StepAbstract = stepAt("abstract");
