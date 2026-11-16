// Post-processes bundled declaration files: strips side-effect CSS imports and writes a
// CommonJS twin (<name>.d.cts) for every <name>.d.ts so `require()` consumers get correct types.
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const dir = process.argv[2] ?? "dist";
for (const name of readdirSync(dir)) {
  if (!name.endsWith(".d.ts")) continue;
  const file = join(dir, name);
  const src = readFileSync(file, "utf8").replace(/^import\s+["'][^"']+\.css["'];?\r?\n/gm, "");
  writeFileSync(file, src);
  copyFileSync(file, join(dir, name.replace(/\.d\.ts$/, ".d.cts")));
}
