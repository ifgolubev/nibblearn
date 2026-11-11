import type { Decorator, Preview } from "@storybook/react-vite";
import { NibblearnProvider } from "@nibblearn/react";
import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "@nibblearn/react/styles.css";

const withNibblearn: Decorator = (Story, ctx) => {
  const theme = (ctx.globals.theme as "light" | "dark") ?? "light";
  return (
    <div
      style={{
        background: theme === "dark" ? "#0c0c0f" : "#ffffff",
        padding: 24,
        minHeight: "100vh",
      }}
    >
      <NibblearnProvider
        theme={theme}

        reducedMotion={Boolean(ctx.globals.reducedMotion)}
      >
        <Story />
      </NibblearnProvider>
    </div>
  );
};

const preview: Preview = {
  decorators: [withNibblearn],
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    a11y: { test: "error" },
  },
  globalTypes: {
    theme: {
      description: "Nibblearn theme",
      toolbar: { title: "Theme", icon: "mirror", items: ["light", "dark"], dynamicTitle: true },
    },
    reducedMotion: {
      description: "Force reduced motion",
      toolbar: {
        title: "Motion",
        icon: "lightning",
        items: [
          { value: false, title: "Full motion" },
          { value: true, title: "Reduced motion" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light", reducedMotion: false },
};

export default preview;
