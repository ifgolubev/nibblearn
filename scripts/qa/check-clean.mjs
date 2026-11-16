// Fails when the given paths have uncommitted changes, including new untracked files
// (`git diff` alone misses those). Usage: node scripts/qa/check-clean.mjs <path>...
import { execFileSync } from "node:child_process";

const paths = process.argv.slice(2);
const out = execFileSync(
  "git",
  ["status", "--porcelain", "--untracked-files=all", "--", ...paths],
  {
    encoding: "utf8",
  },
);
if (out.trim()) {
  console.error(`Generated files differ from their sources. Regenerate and commit:\n${out}`);
  process.exit(1);
}
console.log("generated files are up to date");
