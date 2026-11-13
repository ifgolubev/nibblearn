import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const config: StorybookConfig = {
  framework: { name: "@storybook/react-vite", options: {} },
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  core: { disableTelemetry: true },
  typescript: { reactDocgen: false },
  viteFinal: async (cfg) => {
    cfg.resolve ??= {};
    cfg.resolve.alias = [
      {
        find: "@nibblearn/react/styles.css",
        replacement: r("../../../packages/react/src/styles/index.css"),
      },
      { find: "@nibblearn/react", replacement: r("../../../packages/react/src/index.ts") },
      { find: "@nibblearn/core", replacement: r("../../../packages/core/src/index.ts") },
      { find: "@nibblearn/examples", replacement: r("../../../examples/src/index.ts") },
    ];
    return cfg;
  },
};

export default config;
