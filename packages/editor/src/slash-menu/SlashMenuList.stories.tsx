import type { Meta, StoryObj } from "@storybook/react-vite";
import { type SlashItem, SlashMenuList } from "./SlashMenuList";

const items: SlashItem[] = [
  { id: "capitulo", label: "Título de capítulo", run: () => {} },
  { id: "secao", label: "Seção", run: () => {} },
  { id: "figura", label: "Figura do projeto", run: () => {} },
  { id: "lista", label: "Lista com marcadores", run: () => {} },
  { id: "citacao", label: "Citação bibliográfica", run: () => {} },
  { id: "equacao", label: "Equação (bloco)", run: () => {} },
  { id: "latex", label: "Bloco LaTeX bruto", run: () => {} },
];

const meta = {
  title: "Editor/SlashMenu",
  component: SlashMenuList,
} satisfies Meta<typeof SlashMenuList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = { args: { items } };

export const Filtered: Story = {
  args: { items: items.filter((i) => i.id.startsWith("lista")) },
};

export const EmptyResult: Story = { args: { items: [] } };
