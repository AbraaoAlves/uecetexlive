import type { Meta, StoryObj } from "@storybook/react-vite";
import { EngineToggle } from "./EngineToggle";

const meta = {
  title: "Shell/EngineToggle",
  component: EngineToggle,
  args: { onChange: () => {} },
} satisfies Meta<typeof EngineToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Draft: Story = {
  args: { engine: "swiftlatex-draft", fullReady: false },
};
export const FullNotDownloaded: Story = {
  args: { engine: "swiftlatex-draft", fullReady: false },
};
export const FullReady: Story = {
  args: { engine: "busytex-full", fullReady: true },
};
