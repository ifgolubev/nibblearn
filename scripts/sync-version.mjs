// Writes the version of packages/core/package.json into packages/core/src/version.ts.
// Runs as part of `pnpm version-packages`; `--check` fails when the two differ.
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const pkg = new URL("../packages/core/package.json", import.meta.url);
const file = new URL("../packages/core/src/version.ts", import.meta.url);
const { version } = JSON.parse(readFileSync(pkg, "utf8"));
const source = readFileSync(file, "utf8");
const next = source.replace(
  /export const version = "[^"]*";/,
  `export const version = "${version}";`,
);
if (process.argv.includes("--check")) {
  if (next !== source) {
    console.error(
      `packages/core/src/version.ts is not ${version}. Run: node scripts/sync-version.mjs`,
    );
    process.exit(1);
  }
} else if (next !== source) {
  writeFileSync(file, next);
  console.log(`core version.ts → ${version}`);
}
