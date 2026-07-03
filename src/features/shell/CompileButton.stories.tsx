import type { Meta, StoryObj } from "@storybook/react-vite";
import { CompileButton } from "./CompileButton";

const meta = {
  title: "Shell/CompileButton",
  component: CompileButton,
  args: { onCompile: () => {} },
} satisfies Meta<typeof CompileButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = { args: { status: "idle" } };
export const Warming: Story = { args: { status: "warming" } };
export const Compiling: Story = {
  args: { status: "compiling", progressLabel: "Compilando (2/6): bibliografia…" },
};
export const Ok: Story = { args: { status: "ok" } };
export const ErrorState: Story = { args: { status: "error" } };
