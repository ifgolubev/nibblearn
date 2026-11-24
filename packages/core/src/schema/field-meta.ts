import { SAFE_CSS_COLOR } from "./common";
import { fieldDocs } from "./field-docs.generated";

/** Form hints for authoring tools, emitted as `x-ui` in the JSON Schema. */
export interface UiHint {
  widget?:
    | "text"
    | "textarea"
    | "richtext"
    | "richtext-block"
    | "image"
    | "color"
    | "select"
    | "slider"
    | "number"
    | "switch"
    | "icon"
    | "id"
    | "hidden"
    | "json";
  group?: "content" | "behavior" | "feedback" | "appearance" | "advanced";
  /** For arrays of objects: the property shown as each item's label. */
  itemLabel?: string;
  /** For arrays: singular noun for buttons ("Add card"). */
  itemName?: string;
  order?: number;
  /**
   * For an id that points at another item of the same block: names of the lists the item may
   * be in (`["nodes"]`, `["regions", "rows"]`). Forms offer those items by title.
   */
  ref?: string[];
}

type JsonNode = Record<string, unknown> & {
  type?: string | string[];
  properties?: Record<string, JsonNode>;
  items?: JsonNode;
  oneOf?: JsonNode[];
  anyOf?: JsonNode[];
  enum?: unknown[];
  const?: unknown;
  pattern?: string;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
};

/** Field labels that a humanised key would get wrong or make vague. */
const TITLES: Record<string, string> = {
  id: "ID",
  src: "Image URL",
  alt: "Alternative text",
  isTrue: "Statement is true",
  cta: "Start button label",
  kpiLabel: "KPI label",
  cpc: "CPC",
  x: "Horizontal position (%)",
  y: "Vertical position (%)",
  width: "Width",
  height: "Height",
  delayMs: "Delay (ms)",
  maxSteps: "Maximum steps",
  passThreshold: "Pass threshold",
  hideHeader: "Hide title and instructions",
  schemaVersion: "Schema version",
  correctAction: "Correct action",
  quadrantId: "Quadrant",
  categoryId: "Category",
  targetId: "Target",
  next: "Next node",
  start: "Start node",
  to: "Go to stage",
  dependsOn: "Depends on",
  estimatedMinutes: "Estimated minutes",
  totalBudget: "Total budget",
  frontImage: "Front image",
  backImage: "Back image",
};

const BLOCK_TEXT = new Set([
  "body",
  "details",
  "explanation",
  "intro",
  "summary",
  "takeaway",
  "template",
  "description",
  "back",
]);

const ITEM_LABEL_KEYS = [
  "title",
  "label",
  "prompt",
  "question",
  "text",
  "front",
  "left",
  "subject",
  "instruction",
  "name",
  "id",
];

/** Fields holding the id of another item, and the lists that item lives in. */
const REFERENCES: Record<string, string[]> = {
  categoryId: ["categories"],
  quadrantId: ["quadrants"],
  next: ["nodes"],
  start: ["nodes"],
  to: ["stages"],
  dependsOn: ["stages"],
  targetId: ["regions", "rows", "targets"],
};

const GROUPS: Record<string, UiHint["group"]> = {
  title: "content",
  instructions: "content",
  content: "content",
  behavior: "behavior",
  feedback: "feedback",
  appearance: "appearance",
  scoring: "advanced",
  meta: "advanced",
  schemaVersion: "advanced",
};

/** "allowRetry" → "Allow retry", "pairsPerRound" → "Pairs per round". */
export function humanizeKey(key: string): string {
  if (Object.prototype.hasOwnProperty.call(TITLES, key)) return TITLES[key]!;
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "categories" → "category", "statements" → "statement". */
export function singular(word: string): string {
  if (/ies$/.test(word)) return word.slice(0, -3) + "y";
  if (/(ss|sh|ch|x)es$/.test(word)) return word.slice(0, -2);
  if (/s$/.test(word) && !/ss$/.test(word)) return word.slice(0, -1);
  return word;
}

const hasType = (n: JsonNode, t: string) =>
  n.type === t || (Array.isArray(n.type) && n.type.includes(t));

function isMedia(n: JsonNode): boolean {
  return hasType(n, "object") && !!n.properties?.src && !!n.properties?.alt;
}

function isVideo(n: JsonNode): boolean {
  return (
    hasType(n, "object") && !!n.properties?.src && !!(n.properties.poster ?? n.properties.captions)
  );
}

type Docs = Readonly<Record<string, string>>;
const NO_DOCS: Docs = {};
const sharedDocs = (name: string): Docs =>
  Object.prototype.hasOwnProperty.call(fieldDocs.shared, name) ? fieldDocs.shared[name]! : NO_DOCS;

/**
 * Docs of the shared schema the children of `node` belong to. Names like `title` or `label`
 * mean different things in an image, a video and a module, so shared docs apply by place.
 */
function docsInside(node: JsonNode, key: string | null, depth: number): Docs {
  if (depth === 0) return sharedDocs("moduleBase");
  if (isVideo(node)) return sharedDocs("video");
  if (key === "captions") {
    // The captions file has its own `src`; the video's description of `src` is not about it.
    const { src: _videoSrc, ...captions } = sharedDocs("video");
    return captions;
  }
  if (isMedia(node)) return sharedDocs("media");
  if (depth === 1 && (key === "feedback" || key === "scoring" || key === "appearance"))
    return sharedDocs(key);
  return NO_DOCS;
}

function widgetFor(key: string, n: JsonNode): UiHint["widget"] | undefined {
  if (key === "meta" || key === "schemaVersion") return "hidden";
  if (key === "id") return "id";
  if (isMedia(n)) return "image";
  if (key === "icon" && hasType(n, "string")) return "icon";
  if (hasType(n, "string")) {
    if (n.enum) return "select";
    if (n.pattern === SAFE_CSS_COLOR.source) return "color";
    if (BLOCK_TEXT.has(key) && (n.maxLength ?? 0) >= 4000) return "richtext-block";
    if ((n.maxLength ?? 0) >= 4000) return "richtext";
    if ((n.maxLength ?? Infinity) > 200) return "textarea";
    return "text";
  }
  if (hasType(n, "boolean")) return "switch";
  if (hasType(n, "number") || hasType(n, "integer")) {
    const span = (n.maximum ?? Infinity) - (n.minimum ?? -Infinity);
    return Number.isFinite(span) && span <= 100 ? "slider" : "number";
  }
  return undefined;
}

function annotateNode(
  node: JsonNode,
  key: string | null,
  docs: Docs,
  depth: number,
  /** Docs of the shared schema this node is a field of, if any. */
  place: Docs = NO_DOCS,
) {
  if (depth > 40) return;
  for (const variant of [...(node.oneOf ?? []), ...(node.anyOf ?? [])])
    annotateNode(variant, key, docs, depth + 1, place);
  if (key !== null) {
    if (node.title === undefined) node.title = humanizeKey(key);
    // Inside a shared schema its own docs win: a video's `title` is not the module's.
    const text = [place, docs].find((d) => Object.prototype.hasOwnProperty.call(d, key))?.[key];
    if (node.description === undefined && text) node.description = text;
    const ui: UiHint = { ...((node["x-ui"] as UiHint | undefined) ?? {}) };
    const widget = widgetFor(key, node);
    if (widget && !ui.widget) ui.widget = widget;
    if (depth <= 2 && GROUPS[key] && !ui.group) ui.group = GROUPS[key];
    if (Object.prototype.hasOwnProperty.call(REFERENCES, key) && !ui.ref) {
      const lists = REFERENCES[key]!;
      if (hasType(node, "string")) ui.ref = lists;
      // A list of ids: each entry is a reference.
      else if (hasType(node, "array") && node.items && hasType(node.items, "string"))
        node.items["x-ui"] = { ...((node.items["x-ui"] as UiHint | undefined) ?? {}), ref: lists };
    }
    if (hasType(node, "array") && node.items) {
      ui.itemName ??= singular(humanizeKey(key).toLowerCase());
      const props = node.items.properties;
      const label = props ? ITEM_LABEL_KEYS.find((k) => props[k]) : undefined;
      if (label) ui.itemLabel ??= label;
    }
    if (Object.keys(ui).length) node["x-ui"] = ui;
  }
  if (node.properties) {
    const inside = docsInside(node, key, depth);
    for (const [k, child] of Object.entries(node.properties))
      // Retry settings are shared by many modules; a module's own wording for them wins.
      annotateNode(
        child,
        k,
        k === "behavior" && depth === 0 ? { ...sharedDocs("retryBehavior"), ...docs } : docs,
        depth + 1,
        inside,
      );
  }
  if (node.items) annotateNode(node.items, null, docs, depth + 1);
}

/**
 * Add `title`, `description` and `x-ui` hints to a module's JSON Schema (in place).
 * Descriptions come from the schema source comments; titles from the field names.
 */
export function annotateModuleJsonSchema<T extends Record<string, unknown>>(
  schema: T,
  type: string,
  /** Top-level fields the module ignores: marked `widget: "hidden"` (see `unusedFields`). */
  unusedFields: readonly string[] = [],
): T {
  const docs = Object.prototype.hasOwnProperty.call(fieldDocs.byType, type)
    ? fieldDocs.byType[type]!
    : {};
  const props = (schema as JsonNode).properties ?? {};
  for (const key of unusedFields) {
    if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
    const node = props[key]!;
    node["x-ui"] = { ...((node["x-ui"] as UiHint | undefined) ?? {}), widget: "hidden" };
  }
  annotateNode(schema as JsonNode, null, docs, 0);
  return schema;
}

/** Same as `annotateModuleJsonSchema`, for the lesson schema (without its `modules`). */
export function annotateLessonJsonSchema<T extends Record<string, unknown>>(schema: T): T {
  const node = schema as JsonNode;
  for (const [k, child] of Object.entries(node.properties ?? {}))
    if (k !== "modules") annotateNode(child, k, fieldDocs.global, 1);
  return schema;
}
