import type { Meta, StoryObj } from "@storybook/react-vite";
import { IdleWarmupIndicator } from "./IdleWarmupIndicator";

const meta = {
  title: "Shell/IdleWarmupIndicator",
  component: IdleWarmupIndicator,
} satisfies Meta<typeof IdleWarmupIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Downloading: Story = {
  args: {
    loaded: 96_000_000,
    total: 224_000_000,
    label: "texlive-basic.data",
  },
};
export const BootingEngine: Story = {
  args: {
    loaded: 224_000_000,
    total: 224_000_000,
    label: "Iniciando motor…",
  },
};
