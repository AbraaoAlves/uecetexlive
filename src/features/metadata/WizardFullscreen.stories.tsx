import type { Meta, StoryObj } from "@storybook/react-vite";
import type { MetadataField } from "@/features/project/metadata";
import { WizardFullscreen } from "./WizardFullscreen";

function fields(entries: Record<string, string>): Map<string, MetadataField> {
  const map = new Map<string, MetadataField>();
  for (const [macro, value] of Object.entries(entries)) {
    map.set(macro, { macro, value, start: 0, end: 0 });
  }
  return map;
}

const FILLED = fields({
  titulo: "Jogos Digitais no Ensino de Programação",
  trabalhoacademico: "tccgraduacao",
  autor: "Maria da Silva",
  orientador: "Prof. Dr. João Souza",
  data: "2026",
  local: "Fortaleza -- Ceará",
  resumobody: "Este trabalho investiga o uso de jogos digitais no ensino.",
  palavraschave: "jogos digitais; ensino; programação.",
});

const TOGGLES = new Map(
  [
    ["imprimirdedicatoria", true],
    ["imprimiragradecimentos", true],
    ["imprimirepigrafe", false],
    ["imprimirerrata", false],
    ["imprimirlistadeabreviaturasesiglas", true],
    ["imprimirlistadesimbolos", true],
    ["imprimirglossario", false],
    ["imprimirlistadeilustracoes", true],
    ["imprimirlistadetabelas", true],
    ["imprimirlistadequadros", true],
    ["imprimirlistadealgoritmos", false],
    ["imprimirlistadecodigosfonte", false],
    ["imprimirindice", false],
    ["selectlanguage", false],
  ].map(([macro, enabled]) => [
    macro as string,
    { macro: macro as string, enabled: enabled as boolean },
  ]),
);

const meta = {
  title: "Metadata/WizardFullscreen",
  component: WizardFullscreen,
  parameters: { layout: "fullscreen" },
  args: {
    fields: FILLED,
    onApply: () => {},
    onClose: () => {},
    toggles: TOGGLES,
    onToggle: () => {},
    attachments: [
      {
        path: "elementos-pre-textuais/ficha-catalografica.pdf",
        sizeBytes: 175_366,
        kind: "pdf",
        bytes: new TextEncoder().encode("%PDF-1.7\n%%EOF"),
      },
    ],
    onAddAttachments: () => {},
    onReplaceAttachment: () => {},
    onDeleteAttachment: () => {},
    onCompile: () => {},
  },
} satisfies Meta<typeof WizardFullscreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Opcionais: Story = { args: { initialStep: 8 } };
export const Anexos: Story = { args: { initialStep: 9 } };
export const RevisaoPronta: Story = { args: { initialStep: 10 } };
export const RevisaoComPendencias: Story = {
  args: { initialStep: 10, fields: fields({ trabalhoacademico: "tccgraduacao" }) },
};
export const MeioDoCaminho: Story = { args: { initialStep: 4 } };
