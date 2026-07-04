import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeToggle } from "./ThemeToggle";

const meta = {
  title: "Shell/ThemeToggle",
  component: ThemeToggle,
  args: { onChange: () => {} },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const System: Story = { args: { theme: "system" } };
export const Light: Story = { args: { theme: "light" } };
export const Dark: Story = { args: { theme: "dark" } };
