// Writes JSON Schema files for every built-in module and the lesson into packages/core/dist/schemas.
// Runs after the core build; consumers import them as "@nibblearn/core/schemas/<name>.json".
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const coreDir = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "core");
const core = await import(pathToFileURL(join(coreDir, "dist", "index.js")).href);
const { version } = JSON.parse(readFileSync(join(coreDir, "package.json"), "utf8"));

const outDir = join(coreDir, "dist", "schemas");
mkdirSync(outDir, { recursive: true });
const write = (file, data) =>
  writeFileSync(join(outDir, file), `${JSON.stringify(data, null, 2)}\n`);

const index = { version, lesson: "lesson.schema.json", module: "module.schema.json", modules: {} };
for (const def of core.defaultSchemaRegistry.list()) {
  const file = `${def.type}.schema.json`;
  write(file, core.getModuleJsonSchema(def.type));
  index.modules[def.type] = { file, schemaVersion: def.version ?? 1 };
}
write("module.schema.json", core.getAnyModuleJsonSchema());
write("lesson.schema.json", core.getLessonJsonSchema());
write("index.json", index);
console.log(`JSON Schemas: ${Object.keys(index.modules).length} modules + module + lesson`);
