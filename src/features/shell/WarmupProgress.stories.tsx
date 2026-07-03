import type { Meta, StoryObj } from "@storybook/react-vite";
import { WarmupProgress } from "./WarmupProgress";

const meta = {
  title: "Shell/WarmupProgress",
  component: WarmupProgress,
} satisfies Meta<typeof WarmupProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Downloading: Story = {
  args: {
    loaded: 42_000_000,
    total: 208_000_000,
    label: "texlive-basic.data",
  },
};
export const AlmostDone: Story = {
  args: {
    loaded: 205_000_000,
    total: 208_000_000,
    label: "ubuntu-texlive-science.data",
  },
};
