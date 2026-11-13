// Exports every example module and lesson as JSON files into examples/json/.
// Uses Node's built-in TypeScript type stripping (Node >= 22.6).
// Run: pnpm --filter @nibblearn/examples export:json
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

register("./ts-resolve-hooks.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const out = join(root, "json");

async function exportDir(kind) {
  mkdirSync(join(out, kind), { recursive: true });
  const dir = join(root, "src", kind);
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "index.ts");
  const index = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(join(dir, file)).href);
    for (const [name, value] of Object.entries(mod)) {
      if (!value || typeof value !== "object" || !("id" in value)) continue;
      const target = join(out, kind, `${file.replace(/\.ts$/, "")}.json`);
      writeFileSync(target, JSON.stringify(value, null, 2) + "\n");
      index.push({ export: name, file: `${kind}/${file.replace(/\.ts$/, "")}.json`, id: value.id });
    }
  }
  return index;
}

const modules = await exportDir("modules");
const lessons = await exportDir("lessons");
writeFileSync(join(out, "index.json"), JSON.stringify({ modules, lessons }, null, 2) + "\n");
console.log(`Exported ${modules.length} modules and ${lessons.length} lessons to examples/json/`);
