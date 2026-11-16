import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@nibblearn\/core\/examples$/, replacement: src("../core/src/examples/index.ts") },
      { find: /^@nibblearn\/core$/, replacement: src("../core/src/index.ts") },
      { find: /^@nibblearn\/react$/, replacement: src("../react/src/index.ts") },
    ],
  },
  test: {
    name: "editor",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    css: false,
  },
});
