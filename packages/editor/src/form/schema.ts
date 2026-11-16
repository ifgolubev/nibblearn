import type { JsonSchema, UiHint } from "@nibblearn/react";

/** A JSON Schema reduced to what a form needs. */
export type FormNode =
  | { kind: "string"; enum?: string[]; maxLength?: number; minLength?: number; pattern?: string }
  | {
      kind: "number";
      integer: boolean;
      min?: number;
      max?: number;
      step?: number;
      /** `min` / `max` themselves are not allowed (JSON Schema exclusiveMinimum / exclusiveMaximum). */
      minExclusive?: boolean;
      maxExclusive?: boolean;
    }
  | { kind: "boolean" }
  | { kind: "const"; value: unknown }
  | { kind: "object"; fields: FormField[] }
  | { kind: "array"; item: FormNodeWithMeta; minItems?: number; maxItems?: number }
  | { kind: "union"; discriminator?: string; variants: FormVariant[] }
  | { kind: "record"; value: FormNodeWithMeta }
  | { kind: "unknown" };

export interface FormField {
  key: string;
  node: FormNodeWithMeta;
  required: boolean;
}

export interface FormVariant {
  label: string;
  /** Discriminator value, when the union has one. */
  value?: string;
  node: FormNodeWithMeta;
}

export type FormNodeWithMeta = FormNode & {
  title?: string;
  description?: string;
  default?: unknown;
  /** True when `null` is allowed in addition to the node's own type. */
  nullable?: boolean;
  ui: UiHint;
};

type S = JsonSchema & {
  type?: string | string[];
  properties?: Record<string, S>;
  required?: string[];
  items?: S;
  oneOf?: S[];
  anyOf?: S[];
  enum?: unknown[];
  const?: unknown;
  additionalProperties?: S | boolean;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  title?: string;
  description?: string;
  default?: unknown;
  "x-ui"?: UiHint;
};

const types = (s: S): string[] => (Array.isArray(s.type) ? s.type : s.type ? [s.type] : []);
const isNullSchema = (s: S) => types(s).length === 1 && types(s)[0] === "null";

function meta(s: S, node: FormNode, extra: Partial<FormNodeWithMeta> = {}): FormNodeWithMeta {
  return {
    ...node,
    title: s.title,
    description: s.description,
    default: s.default,
    ui: { ...(s["x-ui"] ?? {}) },
    ...extra,
  } as FormNodeWithMeta;
}

/** The property every variant fixes with `const`, if any. */
function discriminatorOf(variants: S[]): string | undefined {
  const first = variants[0]?.properties;
  if (!first) return undefined;
  return Object.keys(first).find((k) =>
    variants.every((v) => v.properties?.[k] && v.properties[k]!.const !== undefined),
  );
}

/** Normalise a JSON Schema (as produced by `getModuleJsonSchema`) into a form tree. */
export function toFormNode(schema: JsonSchema, depth = 0): FormNodeWithMeta {
  const s = schema as S;
  if (depth > 40) return meta(s, { kind: "unknown" });

  const alternatives = s.oneOf ?? s.anyOf;
  if (alternatives) {
    const real = alternatives.filter((a) => !isNullSchema(a));
    const nullable = real.length < alternatives.length;
    if (real.length === 1) {
      const inner = toFormNode(
        {
          ...real[0]!,
          title: s.title ?? real[0]!.title,
          description: s.description ?? real[0]!.description,
          "x-ui": { ...(real[0]!["x-ui"] ?? {}), ...(s["x-ui"] ?? {}) },
        },
        depth + 1,
      );
      return {
        ...inner,
        nullable: nullable || inner.nullable,
        default: s.default ?? inner.default,
      };
    }
    const discriminator = discriminatorOf(real);
    return meta(
      s,
      {
        kind: "union",
        discriminator,
        variants: real.map((v, i) => {
          const value = discriminator ? String(v.properties![discriminator]!.const) : undefined;
          return {
            label: v.title ?? value ?? `Option ${i + 1}`,
            value,
            node: toFormNode(v, depth + 1),
          };
        }),
      },
      { nullable },
    );
  }

  if (s.const !== undefined) return meta(s, { kind: "const", value: s.const });
  const t = types(s).filter((x) => x !== "null");
  const nullable = types(s).includes("null");

  if (s.enum && s.enum.every((v) => typeof v === "string"))
    return meta(s, { kind: "string", enum: s.enum as string[] }, { nullable });

  switch (t[0]) {
    case "string":
      return meta(
        s,
        { kind: "string", maxLength: s.maxLength, minLength: s.minLength, pattern: s.pattern },
        { nullable },
      );
    case "number":
    case "integer": {
      const minExclusive = s.minimum === undefined && s.exclusiveMinimum !== undefined;
      const min = minExclusive ? s.exclusiveMinimum : s.minimum;
      const maxInclusive = s.maximum !== undefined && s.maximum < Number.MAX_SAFE_INTEGER;
      const maxExclusive = !maxInclusive && s.exclusiveMaximum !== undefined;
      const max = maxInclusive ? s.maximum : s.exclusiveMaximum;
      return meta(
        s,
        {
          kind: "number",
          integer: t[0] === "integer",
          min,
          max,
          step: s.multipleOf,
          ...(minExclusive ? { minExclusive } : {}),
          ...(maxExclusive ? { maxExclusive } : {}),
        },
        { nullable },
      );
    }
    case "boolean":
      return meta(s, { kind: "boolean" }, { nullable });
    case "array":
      return meta(
        s,
        {
          kind: "array",
          item: toFormNode(s.items ?? {}, depth + 1),
          minItems: s.minItems,
          maxItems: s.maxItems,
        },
        { nullable },
      );
    case "object": {
      if (s.properties) {
        const required = new Set(s.required ?? []);
        return meta(
          s,
          {
            kind: "object",
            fields: Object.entries(s.properties).map(([key, child]) => ({
              key,
              node: toFormNode(child, depth + 1),
              required: required.has(key),
            })),
          },
          { nullable },
        );
      }
      if (s.additionalProperties && typeof s.additionalProperties === "object")
        return meta(
          s,
          { kind: "record", value: toFormNode(s.additionalProperties, depth + 1) },
          { nullable },
        );
      return meta(s, { kind: "unknown" }, { nullable });
    }
    default:
      return meta(s, { kind: "unknown" });
  }
}
