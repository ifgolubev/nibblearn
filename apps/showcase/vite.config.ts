import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.SHOWCASE_BASE ?? "/",
  resolve: {
    alias: [
      {
        find: "@nibblearn/react/styles.css",
        replacement: r("../../packages/react/src/styles/index.css"),
      },
      { find: "@nibblearn/react", replacement: r("../../packages/react/src/index.ts") },
      { find: "@nibblearn/core", replacement: r("../../packages/core/src/index.ts") },
      { find: "@nibblearn/examples", replacement: r("../../examples/src/index.ts") },
      { find: "@", replacement: r("./src") },
    ],
  },
  server: { port: 5173, fs: { allow: [r("../..")] } },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        manualChunks: (id: string) => {
          if (
            id.includes("react-markdown") ||
            id.includes("remark") ||
            id.includes("micromark") ||
            id.includes("mdast") ||
            id.includes("hast") ||
            id.includes("unified") ||
            id.includes("vfile") ||
            id.includes("unist")
          )
            return "markdown";
        },
      },
    },
  },
});
