import { defaultSchemaRegistry, type SchemaRegistry } from "./schema/registry";
import type { ValidationIssue } from "./validate";

export type MigrationResult<T> =
  | {
      success: true;
      data: T;
      /** Version the input was saved with. */
      from: number;
      /** Version of the returned config. */
      to: number;
      /** False when the input was already current; `data` is then the input object itself. */
      changed: boolean;
    }
  | { success: false; data?: undefined; issues: ValidationIssue[] };

export interface MigrateOptions {
  /** Registry used to resolve module types. Defaults to the built-in modules. */
  registry?: SchemaRegistry;
}

const hasOwn = (obj: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(obj, key);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(path: string, message: string): MigrationResult<never> {
  return {
    success: false,
    issues: [{ path, segments: path === "(root)" ? [] : [path], message }],
  };
}

/**
 * Upgrade a stored module config to the current schema version of its type.
 *
 * Run it before `validateModule()`: it does not validate the config, it only applies the
 * registered migrations in order. Configs without `schemaVersion` are treated as version 1.
 * The input is never mutated; when nothing needs to change the same object is returned.
 */
export function migrateModule(
  input: unknown,
  options: MigrateOptions = {},
): MigrationResult<Record<string, unknown>> {
  const registry = options.registry ?? defaultSchemaRegistry;
  if (!isRecord(input) || typeof input.type !== "string")
    return fail("type", "module type is required");
  const def = registry.get(input.type);
  if (!def)
    return fail(
      "type",
      `unknown module type "${input.type}". Known types: ${registry.types().join(", ")}`,
    );

  const raw = hasOwn(input, "schemaVersion") ? input.schemaVersion : undefined;
  const from = raw === undefined ? 1 : raw;
  if (typeof from !== "number" || !Number.isInteger(from) || from < 1)
    return fail("schemaVersion", "schemaVersion must be an integer of 1 or more");
  const to = def.version ?? 1;
  if (from > to)
    return fail(
      "schemaVersion",
      `module was saved with a newer schema version (${from}) than this library supports (${to})`,
    );
  if (from === to) return { success: true, data: input, from, to, changed: false };

  let current: Record<string, unknown> = input;
  for (let v = from; v < to; v++) {
    const migration = def.migrations && hasOwn(def.migrations, v) ? def.migrations[v] : undefined;
    if (typeof migration !== "function")
      return fail("schemaVersion", `no migration from version ${v} to ${v + 1} for "${def.type}"`);
    const next = migration(current);
    if (!isRecord(next))
      return fail("schemaVersion", `migration from version ${v} did not return an object`);
    current = next;
  }
  return { success: true, data: { ...current, schemaVersion: to }, from, to, changed: true };
}

/**
 * Apply `migrateModule()` to every module of a stored lesson. The lesson's own
 * `schemaVersion` is left untouched (only version 1 exists).
 */
export function migrateLesson(
  input: unknown,
  options: MigrateOptions = {},
): MigrationResult<Record<string, unknown>> {
  if (!isRecord(input)) return fail("(root)", "lesson must be an object");
  const modules = input.modules;
  if (!Array.isArray(modules)) return fail("modules", "lesson modules must be an array");
  const version = typeof input.schemaVersion === "number" ? input.schemaVersion : 1;

  const issues: ValidationIssue[] = [];
  let changed = false;
  const next = modules.map((m, i) => {
    const res = migrateModule(m, options);
    if (!res.success) {
      for (const issue of res.issues)
        issues.push({
          path: `modules[${i}].${issue.path}`,
          ...(issue.segments ? { segments: ["modules", i, ...issue.segments] } : {}),
          message: issue.message,
        });
      return m;
    }
    if (res.changed) changed = true;
    return res.data;
  });
  if (issues.length) return { success: false, issues };
  if (!changed) return { success: true, data: input, from: version, to: version, changed: false };
  return {
    success: true,
    data: { ...input, modules: next },
    from: version,
    to: version,
    changed: true,
  };
}
