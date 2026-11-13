import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/core", "packages/react"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**"],
      exclude: ["**/*.test.*", "**/*.d.ts"],
      reporter: ["text-summary", "html"],
      // Floors, not targets: CI fails if coverage drops below these.
      thresholds: { lines: 88, statements: 85, functions: 85, branches: 75 },
    },
  },
});
