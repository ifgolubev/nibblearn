// Checks docs against the built packages: every name imported from @nibblearn/* in a
// code sample must be exported, and every relative markdown link must resolve.
// Usage: pnpm build && node scripts/qa/docs-check.mjs
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);
const root = resolve(dirname(new URL(import.meta.url).pathname), "../..");
const dts = {
  "@nibblearn/react": readFileSync(join(root, "packages/react/dist/index.d.ts"), "utf8"),
  "@nibblearn/core": readFileSync(join(root, "packages/core/dist/index.d.ts"), "utf8"),
};
const runtime = {
  "@nibblearn/react": Object.keys(require(join(root, "packages/react/dist/index.cjs"))),
  "@nibblearn/core": Object.keys(require(join(root, "packages/core/dist/index.cjs"))),
};
const exported = (pkg, name) =>
  runtime[pkg].includes(name) ||
  new RegExp(`\\b(?:type|interface|class|const|function)\\s+${name}\\b`).test(dts[pkg]) ||
  new RegExp(`\\b${name}\\b[^;]*\\}\\s*;?\\s*$`, "m").test(
    dts[pkg].split("export {").slice(1).join("export {"),
  );

const files = [
  "README.md",
  "packages/react/README.md",
  "packages/core/README.md",
  "packages/react/MODULE_GUIDE.md",
  "CONTRIBUTING.md",
  ...readdirSync(join(root, "docs"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => `docs/${f}`),
];
const problems = [];
let imports = 0;
let links = 0;
for (const file of files) {
  const text = readFileSync(join(root, file), "utf8");
  for (const m of text.matchAll(
    /import\s+(type\s+)?\{([^}]+)\}\s+from\s+["'](@nibblearn\/(?:react|core))["']/g,
  )) {
    for (const raw of m[2].split(",")) {
      const name = raw
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0]
        .trim();
      if (!name) continue;
      imports++;
      if (!exported(m[3], name)) problems.push(`${file}: "${name}" is not exported from ${m[3]}`);
    }
  }
  for (const m of text.matchAll(
    /\]\((\.{0,2}\/?[^)#\s]+\.(?:md|json|ts|tsx|css|yml))(#[^)]*)?\)/g,
  )) {
    if (/^https?:/.test(m[1])) continue;
    links++;
    if (!existsSync(resolve(dirname(join(root, file)), m[1])))
      problems.push(`${file}: broken link ${m[1]}`);
  }
}
console.log(`${files.length} files, ${imports} imported names, ${links} relative links checked`);
if (problems.length) {
  console.log(problems.join("\n"));
  process.exit(1);
}
console.log("docs OK");
