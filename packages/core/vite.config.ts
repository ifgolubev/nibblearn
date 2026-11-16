import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: { index: "src/index.ts", examples: "src/examples/index.ts" },
      formats: ["es", "cjs"],
      fileName: (format, name) => `${name}.${format === "es" ? "js" : "cjs"}`,
    },
    sourcemap: true,
    minify: false,
    rollupOptions: {
      external: ["zod"],
    },
  },
});
