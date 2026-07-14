import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)", "../packages/*/src/**/*.stories.@(ts|tsx)"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: (viteConfig) => {
    // Storybook inherits the app's vite.config.ts plugins. VitePWA's service
    // worker precaches the Storybook shell and its navigation fallback serves
    // the manager page instead of iframe.html, breaking every story in static
    // builds — drop it here.
    viteConfig.plugins = (viteConfig.plugins ?? [])
      .flat(Number.POSITIVE_INFINITY)
      .filter(
        (plugin) =>
          !(
            plugin &&
            typeof plugin === "object" &&
            "name" in plugin &&
            typeof plugin.name === "string" &&
            plugin.name.startsWith("vite-plugin-pwa")
          ),
      );
    return viteConfig;
  },
};

export default config;
