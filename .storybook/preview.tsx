import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { Preview } from "@storybook/react-vite";
import "../src/styles.css";

const preview: Preview = {
  decorators: [
    // Mirrors the app root (src/router.tsx): components render bare
    // Tooltip.Root and rely on an ambient provider.
    (Story) => (
      <TooltipPrimitive.Provider delayDuration={400}>
        <Story />
      </TooltipPrimitive.Provider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
};

export default preview;
