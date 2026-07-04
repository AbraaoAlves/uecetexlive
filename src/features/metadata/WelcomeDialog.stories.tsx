import type { Meta, StoryObj } from "@storybook/react-vite";
import { WelcomeDialog } from "./WelcomeDialog";

const meta = {
  title: "Metadata/WelcomeDialog",
  component: WelcomeDialog,
  parameters: { layout: "fullscreen" },
  args: {
    onFill: () => {},
    onLater: () => {},
  },
} satisfies Meta<typeof WelcomeDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstRun: Story = {};
