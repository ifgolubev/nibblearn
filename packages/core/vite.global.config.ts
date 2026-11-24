import { defineConfig } from "vite";

// One self-contained script (zod included) that defines the global `NibblearnCore`. It uses
// no DOM and no Node APIs, so it also runs in an embedded JavaScript engine on a server that
// is not written in JavaScript (GraalJS on the JVM, for instance) to validate and grade there.
export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/index.ts",
      formats: ["iife"],
      name: "NibblearnCore",
      fileName: () => "nibblearn-core.global.js",
    },
    target: "es2020",
    sourcemap: false,
    minify: true,
  },
});
