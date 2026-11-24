// Checks that the self-contained core script runs in a bare JavaScript engine: no DOM, no Node
// globals, no `Intl`, and with code generation from strings switched off. That is what an
// embedded engine on a non-JavaScript server (GraalJS on the JVM, for instance) provides.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import process from "node:process";

const file = new URL("../packages/core/dist/nibblearn-core.global.js", import.meta.url);
const source = readFileSync(file, "utf8");
const packageVersion = JSON.parse(
  readFileSync(new URL("../packages/core/package.json", import.meta.url), "utf8"),
).version;
const example = (name) =>
  readFileSync(new URL(`../examples/json/modules/${name}.json`, import.meta.url), "utf8");

function run(label, contextOptions) {
  const context = vm.createContext({}, contextOptions);
  vm.runInContext("globalThis.Intl = undefined;", context);
  vm.runInContext(source, context, { filename: "nibblearn-core.global.js" });
  // Only JSON strings cross the boundary, as they would from another language.
  context.configJson = example("true-false");
  const out = vm.runInContext(
    `(() => {
      const core = NibblearnCore;
      const config = JSON.parse(configJson);
      const valid = core.validateModule(config);
      if (!valid.success) return JSON.stringify({ error: "config", issues: valid.issues });
      const answers = valid.data.content.statements.map((s, itemIndex) => ({
        itemIndex,
        response: s.isTrue,
      }));
      return JSON.stringify({
        grade: core.gradeModule(config, { answers }),
        rejected: core.gradeModule(config, { answers: [{ itemIndex: 999, response: true }] }),
        invalid: core.validateModule({ type: "true-false" }).success,
        limits: core.getModuleLimits("choice-challenge")["content.questions"],
        version: core.version,
      });
    })()`,
    context,
  );
  const res = JSON.parse(out);
  const ok =
    res.grade?.success === true &&
    res.grade.grade.score === 1 &&
    res.rejected?.reason === "invalid-response" &&
    res.invalid === false &&
    res.limits?.max > 0 &&
    res.version === packageVersion;
  if (!ok) {
    console.error(`core global script failed (${label}):`, out);
    process.exit(1);
  }
}

run("bare context", undefined);
run("no code generation from strings", { codeGeneration: { strings: false, wasm: false } });
console.log("core global script: runs without DOM, Node, Intl or eval");
