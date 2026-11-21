import { z } from "zod";
import { annotateLessonJsonSchema, annotateModuleJsonSchema } from "./schema/field-meta";
import { lessonShellSchema } from "./schema/lesson";
import {
  defaultSchemaRegistry,
  type ModuleSchemaDefinition,
  type SchemaRegistry,
} from "./schema/registry";

export interface JsonSchemaOptions {
  /** Registry used to resolve module types. Defaults to the built-in modules. */
  registry?: SchemaRegistry;
  /**
   * "input" (default): what authors write; fields with defaults are optional.
   * "output": the parsed form, where defaulted fields are always present.
   */
  io?: "input" | "output";
}

/** A JSON Schema (draft 2020-12) document. */
export type JsonSchema = Record<string, unknown>;

function convert(schema: z.ZodType, io: "input" | "output"): JsonSchema {
  return z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io,
    // Refinements cannot be expressed; emit the base type instead of throwing.
    unrepresentable: "any",
    // Inline everything: form generators and simple validators do not follow `$ref`.
    reused: "inline",
  }) as JsonSchema;
}

function moduleSchemaId(def: ModuleSchemaDefinition): string {
  return `urn:nibblearn:module:${def.type}:${def.version ?? 1}`;
}

/**
 * JSON Schema for one module type, or `undefined` for an unknown type.
 * Checks written as Zod refinements (for example "every answer refers to an existing
 * option") are not part of the result; run `validateModule()` where possible.
 */
export function getModuleJsonSchema(
  type: string,
  options: JsonSchemaOptions = {},
): JsonSchema | undefined {
  const registry = options.registry ?? defaultSchemaRegistry;
  const def = registry.get(type);
  if (!def) return undefined;
  const { $schema, ...rest } = annotateModuleJsonSchema(
    convert(def.schema, options.io ?? "input"),
    def.type,
    def.unusedFields,
  );
  return {
    $schema,
    $id: moduleSchemaId(def),
    title: def.name,
    description: def.description,
    ...rest,
    ...(def.icon ? { "x-icon": def.icon } : {}),
  };
}

function anyModuleSchema(registry: SchemaRegistry, io: "input" | "output"): JsonSchema {
  return {
    oneOf: registry.list().map((def) => {
      const { $schema: _ignored, ...rest } = annotateModuleJsonSchema(
        convert(def.schema, io),
        def.type,
        def.unusedFields,
      );
      return { title: def.name, ...rest };
    }),
  };
}

/** JSON Schema accepting any module of the registry (a `oneOf` over all types). */
export function getAnyModuleJsonSchema(options: JsonSchemaOptions = {}): JsonSchema {
  const registry = options.registry ?? defaultSchemaRegistry;
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "urn:nibblearn:module",
    title: "Nibblearn module",
    ...anyModuleSchema(registry, options.io ?? "input"),
  };
}

/** JSON Schema for a whole lesson (`schemaVersion: 1`) with the registry's modules. */
export function getLessonJsonSchema(options: JsonSchemaOptions = {}): JsonSchema {
  const registry = options.registry ?? defaultSchemaRegistry;
  const io = options.io ?? "input";
  const { $schema, properties, ...rest } = annotateLessonJsonSchema(
    convert(lessonShellSchema, io),
  ) as JsonSchema & {
    properties: Record<string, JsonSchema>;
  };
  const shellModules = properties.modules ?? {};
  return {
    $schema,
    $id: "urn:nibblearn:lesson:1",
    title: "Nibblearn lesson",
    ...rest,
    properties: {
      ...properties,
      modules: {
        type: "array",
        minItems: shellModules.minItems,
        maxItems: shellModules.maxItems,
        items: anyModuleSchema(registry, io),
      },
    },
  };
}
