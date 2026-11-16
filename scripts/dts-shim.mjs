// Copies the built declarations of sibling packages into <pkg>/.dts-shim/node_modules/@nibblearn/<dep>/
// so that dts-bundle-generator treats them as external libraries (and writes
// `import … from "@nibblearn/<dep>"`) instead of inlining a private copy of their types.
// pnpm links workspace packages through symlinks whose real path is outside node_modules,
// which is what made the bundler inline them.
// Usage: node scripts/dts-shim.mjs <packageDir> <dep> [<dep>…]
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [pkgDir, ...deps] = process.argv.slice(2);
const shim = join(resolve(pkgDir), ".dts-shim", "node_modules", "@nibblearn");
rmSync(join(resolve(pkgDir), ".dts-shim"), { recursive: true, force: true });
for (const dep of deps) {
  const out = join(shim, dep);
  mkdirSync(out, { recursive: true });
  cpSync(join(root, "packages", dep, "dist", "index.d.ts"), join(out, "index.d.ts"));
  writeFileSync(
    join(out, "package.json"),
    JSON.stringify({ name: `@nibblearn/${dep}`, types: "index.d.ts" }),
  );
}
