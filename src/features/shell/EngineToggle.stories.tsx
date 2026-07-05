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
  args: { engine: "busytex-draft" },
};
export const Full: Story = {
  args: { engine: "busytex-full" },
};
