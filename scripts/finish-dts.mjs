// Post-processes the bundled declaration file: strips side-effect CSS imports and
// writes a CommonJS twin (index.d.cts) so `require()` consumers get correct types.
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const dir = process.argv[2] ?? "dist";
const file = join(dir, "index.d.ts");
const src = readFileSync(file, "utf8").replace(/^import\s+["'][^"']+\.css["'];?\r?\n/gm, "");
writeFileSync(file, src);
copyFileSync(file, join(dir, "index.d.cts"));
