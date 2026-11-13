import type { z } from "zod";
import {
  lessonSchema,
  lessonShellSchema,
  type BuiltInModuleConfig,
  type BuiltInModuleInput,
  type Lesson,
  type LessonInput,
  type ModuleConfig,
} from "./schema/lesson";
import { defaultSchemaRegistry, type SchemaRegistry } from "./schema/registry";

export interface ValidationIssue {
  /** JSON path, e.g. "modules[2].content.questions[0].options". */
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { success: true; data: T; issues: [] }
  | { success: false; data?: undefined; issues: ValidationIssue[] };

export class LessonValidationError extends Error {
  override readonly name = "LessonValidationError";
  constructor(public readonly issues: ValidationIssue[]) {
    super(formatIssues(issues));
  }
}

export function formatPath(path: ReadonlyArray<PropertyKey>): string {
  let out = "";
  for (const seg of path) {
    if (typeof seg === "number") out += `[${seg}]`;
    else out += out ? `.${String(seg)}` : String(seg);
  }
  return out || "(root)";
}

/** Convert Zod issues into readable, path-addressed issues. */
export function issuesFromZod(
  error: z.ZodError,
  prefix: ReadonlyArray<PropertyKey> = [],
): ValidationIssue[] {
  return error.issues.map((issue) => {
    let message = issue.message;
    if (issue.code === "invalid_union" && "errors" in issue) {
      message = "value does not match any supported shape";
    }
    if (issue.code === "invalid_value" && "values" in issue) {
      const values = (issue as { values: unknown[] }).values;
      message = `expected one of ${values.map((v) => JSON.stringify(v)).join(", ")}`;
    }
    return { path: formatPath([...prefix, ...issue.path]), message };
  });
}

export function formatIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) return "No issues.";
  return issues.map((i) => `• ${i.path}: ${i.message}`).join("\n");
}

export interface ValidateOptions {
  /** Registry used to resolve module schemas. Defaults to the built-in modules. */
  registry?: SchemaRegistry;
}

/**
 * Validate lesson JSON. Returns parsed data with defaults applied, or a list of readable issues.
 * Never throws for invalid input.
 */
export function validateLesson(
  input: unknown,
  options: ValidateOptions = {},
): ValidationResult<Lesson> {
  const registry = options.registry ?? defaultSchemaRegistry;

  if (registry === defaultSchemaRegistry) {
    const res = lessonSchema.safeParse(input);
    if (res.success) return { success: true, data: res.data as Lesson, issues: [] };
    return { success: false, issues: dedupe(issuesFromZod(res.error)) };
  }

  const shell = lessonShellSchema.safeParse(input);
  if (!shell.success) return { success: false, issues: dedupe(issuesFromZod(shell.error)) };

  const issues: ValidationIssue[] = [];
  const modules: ModuleConfig[] = [];
  const seen = new Set<string>();
  shell.data.modules.forEach((raw, i) => {
    if (seen.has(raw.id))
      issues.push({ path: `modules[${i}].id`, message: `duplicate module id "${raw.id}"` });
    seen.add(raw.id);
    const def = registry.get(raw.type);
    if (!def) {
      issues.push({
        path: `modules[${i}].type`,
        message: `unknown module type "${raw.type}". Known types: ${registry.types().join(", ")}`,
      });
      return;
    }
    const parsed = def.schema.safeParse(raw);
    if (parsed.success) modules.push(parsed.data as ModuleConfig);
    else issues.push(...issuesFromZod(parsed.error, ["modules", i]));
  });
  if (issues.length) return { success: false, issues: dedupe(issues) };
  return { success: true, data: { ...shell.data, modules } as Lesson, issues: [] };
}

/** Validate a single module config. */
export function validateModule(
  input: unknown,
  options: ValidateOptions = {},
): ValidationResult<ModuleConfig> {
  const registry = options.registry ?? defaultSchemaRegistry;
  const type =
    typeof input === "object" && input !== null ? (input as { type?: unknown }).type : undefined;
  if (typeof type !== "string")
    return { success: false, issues: [{ path: "type", message: "module type is required" }] };
  const def = registry.get(type);
  if (!def)
    return {
      success: false,
      issues: [
        {
          path: "type",
          message: `unknown module type "${type}". Known types: ${registry.types().join(", ")}`,
        },
      ],
    };
  const parsed = def.schema.safeParse(input);
  if (parsed.success) return { success: true, data: parsed.data as ModuleConfig, issues: [] };
  return { success: false, issues: dedupe(issuesFromZod(parsed.error)) };
}

/**
 * Define a lesson with full type inference and validation. Throws `LessonValidationError`
 * with a readable message when the lesson is invalid.
 */
export function defineLesson(input: LessonInput, options: ValidateOptions = {}): Lesson {
  const res = validateLesson(input, options);
  if (!res.success) throw new LessonValidationError(res.issues);
  return res.data;
}

/** The parsed config type for a given built-in module `type`. */
export type ModuleConfigFor<T extends string> = Extract<BuiltInModuleConfig, { type: T }>;

/**
 * Define a single module config with validation and type narrowing. Throws on invalid input.
 *
 * @example
 * const deck = defineModule({ id: "d", type: "flashcards", content: { cards: [...] } });
 * // deck is FlashcardsConfig
 */
export function defineModule<T extends BuiltInModuleInput>(
  input: T,
  options?: ValidateOptions,
): ModuleConfigFor<T["type"]>;
export function defineModule<T extends { id: string; type: string }>(
  input: T,
  options?: ValidateOptions,
): ModuleConfig;
export function defineModule(
  input: { id: string; type: string },
  options: ValidateOptions = {},
): ModuleConfig {
  const res = validateModule(input, options);
  if (!res.success) throw new LessonValidationError(res.issues);
  return res.data;
}

function dedupe(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.path}::${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
