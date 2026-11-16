import type { FormNodeWithMeta } from "./schema";

/** A new id like `card-3` that is not used by `siblings` (deterministic: a counter, not random). */
export function uniqueId(prefix: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = prefix.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "item";
  for (let n = 1; n < 100_000; n++) {
    const id = `${base}-${n}`;
    if (!used.has(id)) return id;
  }
  return `${base}-${used.size + 1}`;
}

export interface DefaultContext {
  /** Ids already used by siblings, for `id` fields. */
  takenIds?: Iterable<string>;
  /** Prefix for generated ids, e.g. "card". */
  idPrefix?: string;
}

/**
 * A minimal value for a node: required object fields filled recursively, `minItems` array
 * items, the first enum value, `min` for numbers. Optional fields are left out.
 */
export function defaultFor(node: FormNodeWithMeta, ctx: DefaultContext = {}, depth = 0): unknown {
  if (depth > 20) return undefined;
  if (node.default !== undefined) return structuredClone(node.default);
  switch (node.kind) {
    case "string":
      if (node.ui.widget === "id") return uniqueId(ctx.idPrefix ?? "item", ctx.takenIds ?? []);
      if (node.enum?.length) return node.enum[0];
      return node.minLength ? "New text" : "";
    case "number": {
      // An exclusive bound is not a valid value: step inside it.
      const inc = node.step ?? 1;
      const lo = node.min === undefined ? undefined : node.min + (node.minExclusive ? inc : 0);
      const hi = node.max === undefined ? undefined : node.max - (node.maxExclusive ? inc : 0);
      if (lo !== undefined && lo > 0) return lo;
      if (hi !== undefined && hi < 0) return hi;
      return 0;
    }
    case "boolean":
      return false;
    case "const":
      return node.value;
    case "object": {
      const out: Record<string, unknown> = {};
      for (const f of node.fields) {
        if (!f.required) continue;
        const v = defaultFor(f.node, f.key === "id" ? ctx : { idPrefix: f.key }, depth + 1);
        if (v !== undefined) out[f.key] = v;
      }
      return out;
    }
    case "array": {
      const n = node.minItems ?? 0;
      const items: unknown[] = [];
      const prefix = node.ui.itemName ?? "item";
      for (let i = 0; i < n; i++) {
        const taken = items
          .map((it) =>
            typeof it === "object" && it && "id" in it ? String((it as { id: unknown }).id) : "",
          )
          .filter(Boolean);
        items.push(defaultFor(node.item, { idPrefix: prefix, takenIds: taken }, depth + 1));
      }
      return items;
    }
    case "union": {
      const first = node.variants[0];
      return first ? defaultFor(first.node, ctx, depth + 1) : undefined;
    }
    case "record":
      return {};
    default:
      return null;
  }
}
