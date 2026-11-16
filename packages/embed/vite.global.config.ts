import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone script for pages without a bundler: React and Nibblearn included, exposes
// `window.Nibblearn` and registers <nibblearn-module> on load.
export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/global.ts",
      formats: ["iife"],
      name: "Nibblearn",
      fileName: () => "nibblearn.global.js",
      // Nibblearn's stylesheet (from @nibblearn/react), published as @nibblearn/embed/styles.css.
      cssFileName: "styles",
    },
    // No source map: it would add ~4 MB to the package for a minified convenience build.
    sourcemap: false,
    minify: true,
    cssCodeSplit: false,
  },
});
