# Module versions and migrations

Products that store many separate blocks (not whole lessons) need a way to upgrade stored content when a module's schema changes. Every module config can carry a `schemaVersion`, and `migrateModule()` upgrades a stored config to the version the installed library expects.

## The rules

- A config without `schemaVersion` is version 1. All built-in modules are at version 1 today.
- Nibblearn only makes additive changes within a version (new optional fields, new module types). A new version is introduced only for a change that old configs cannot satisfy, and then it ships with a migration.
- `migrateModule()` never validates and never mutates its input. Run it before `validateModule()`.

## Upgrading stored content

```ts
import { migrateModule, validateModule } from "@nibblearn/core";

function load(stored: unknown) {
  const migrated = migrateModule(stored);
  if (!migrated.success) throw new Error(migrated.issues.map((i) => i.message).join("; "));
  if (migrated.changed) saveBack(migrated.data); // optional: store the upgraded config

  const valid = validateModule(migrated.data);
  if (!valid.success) throw new Error("Invalid block");
  return valid.data;
}
```

The result tells you `from` and `to` versions and whether anything `changed`. When nothing changes, `data` is the same object you passed in. `migrateLesson()` applies the same to every module of a lesson.

A config saved by a newer library than the one installed (for example `schemaVersion: 3` while the library knows version 2) is rejected rather than guessed at.

## Writing a migration for a custom module

Give the module definition a `version` and one function per step. `migrations[n]` turns a version-n config into version n + 1:

```ts
import { z } from "zod";
import { SchemaRegistry, migrateModule } from "@nibblearn/core";

const pollSchema = z.object({
  id: z.string(),
  type: z.literal("poll"),
  schemaVersion: z.number().optional(),
  question: z.string(),
  choices: z.array(z.object({ label: z.string() })),
});

const registry = new SchemaRegistry([
  {
    type: "poll",
    name: "Poll",
    description: "Ask the group a question.",
    category: "practice",
    schema: pollSchema,
    version: 2,
    migrations: {
      // v1 stored `prompt` and `options: string[]`.
      1: ({ prompt, options, ...rest }) => ({
        ...rest,
        question: prompt,
        choices: (options as string[]).map((label) => ({ label })),
      }),
    },
  },
]);

migrateModule(
  { id: "p", type: "poll", prompt: "Tea or coffee?", options: ["Tea", "Coffee"] },
  { registry },
);
// → { success: true, from: 1, to: 2, changed: true, data: { …, schemaVersion: 2 } }
```

Migrations must return a new object. They run in order, so a version-1 config passes through every step up to the current version.
