import { defaultSchemaRegistry } from "../schema/registry";
import { stripMarkup } from "../text";
import {
  heading,
  list,
  paragraph,
  type ResolvedToTextOptions,
  type TextNode,
  type ToTextOptions,
} from "./nodes";
import { builtInSerializers } from "./serializers";

export type { TextNode, ToTextOptions, TextSerializer, ResolvedToTextOptions } from "./nodes";

const hasOwn = (obj: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(obj, key);

function resolve(options: ToTextOptions): ResolvedToTextOptions {
  return {
    format: options.format ?? "text",
    includeAnswers: options.includeAnswers ?? false,
    includeFeedback: options.includeFeedback ?? false,
  };
}

/** Keys whose string values are learner-facing text (used for unknown or invalid configs). */
export const TEXT_KEYS = [
  "title",
  "instructions",
  "text",
  "prompt",
  "question",
  "label",
  "description",
  "explanation",
  "body",
  "front",
  "back",
  "caption",
  "alt",
  "name",
  "statement",
  "message",
  "hint",
] as const;

const SKIP_KEYS = new Set(["id", "type", "src", "color", "accent", "icon", "meta", "behavior"]);
const FEEDBACK_KEYS = new Set(["explanation", "hint"]);

/**
 * Collect learner-facing strings from any config, in document order. Used as the fallback for
 * custom modules without a serializer and for configs that do not validate.
 */
export function collectText(
  value: unknown,
  options: Pick<ToTextOptions, "includeFeedback"> = {},
): string[] {
  const out: string[] = [];
  const keys = new Set<string>(TEXT_KEYS);
  const visit = (v: unknown, depth: number) => {
    if (depth > 20 || v === null || typeof v !== "object") return;
    if (Array.isArray(v)) {
      for (const item of v) visit(item, depth + 1);
      return;
    }
    for (const key of Object.keys(v)) {
      if (SKIP_KEYS.has(key)) continue;
      if (!options.includeFeedback && FEEDBACK_KEYS.has(key)) continue;
      const child = (v as Record<string, unknown>)[key];
      if (typeof child === "string") {
        if (keys.has(key) && child.trim()) out.push(child);
      } else visit(child, depth + 1);
    }
  };
  visit(value, 0);
  return out;
}

/** The content of a module as format-neutral nodes. Never throws. */
export function moduleToTextNodes(config: unknown, options: ToTextOptions = {}): TextNode[] {
  const o = resolve(options);
  const registry = options.registry ?? defaultSchemaRegistry;
  const type =
    typeof config === "object" && config !== null ? (config as { type?: unknown }).type : undefined;
  const def = typeof type === "string" ? registry.get(type) : undefined;
  const parsed = def?.schema.safeParse(config);

  if (def && parsed?.success) {
    const cfg = parsed.data as {
      title?: string;
      instructions?: string;
      feedback?: Record<string, string>;
    };
    const body = def.toText
      ? def.toText(parsed.data as never, o)
      : typeof type === "string" && hasOwn(builtInSerializers, type)
        ? builtInSerializers[type]!(parsed.data as never, o)
        : collectText(parsed.data, o).map((text): TextNode => ({ kind: "paragraph", text }));
    const fb = o.includeFeedback ? (cfg.feedback ?? {}) : {};
    return [
      ...heading(2, cfg.title),
      ...paragraph(cfg.instructions),
      ...body,
      ...paragraph(fb.complete),
    ];
  }
  return collectText(config, o).map((text): TextNode => ({ kind: "paragraph", text }));
}

// ---- rendering --------------------------------------------------------------------------------

function renderNodes(nodes: TextNode[], o: ResolvedToTextOptions): string {
  const md = o.format === "markdown";
  const t = (s: string) => (md ? s : stripMarkup(s));
  const blocks: string[] = [];
  for (const n of nodes) {
    switch (n.kind) {
      case "heading":
        blocks.push(md ? `${"#".repeat(n.level)} ${n.text}` : t(n.text));
        break;
      case "paragraph":
        blocks.push(t(n.text));
        break;
      case "list":
        blocks.push(
          n.items
            .map((item, i) => `${n.ordered ? `${(n.start ?? 1) + i}.` : "-"} ${t(item)}`)
            .join("\n"),
        );
        break;
      case "question": {
        // The prompt is not wrapped in bold: it may already contain **bold** markup.
        const lines = [t(n.prompt)];
        for (const opt of n.options ?? []) {
          const text = t(opt.text);
          if (opt.correct === true) lines.push(md ? `- **${text}** ✓` : `- ${text} (correct)`);
          else lines.push(`- ${text}`);
        }
        if (n.answer) lines.push(md ? `*Answer:* ${n.answer}` : `Answer: ${t(n.answer)}`);
        if (n.explanation)
          lines.push(md ? `*Explanation:* ${n.explanation}` : `Explanation: ${t(n.explanation)}`);
        blocks.push(lines.join("\n"));
        break;
      }
      case "pairs":
        if (md) {
          const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
          const [a, b] = n.header ?? ["", ""];
          blocks.push(
            [
              `| ${esc(a)} | ${esc(b)} |`,
              "| --- | --- |",
              ...n.rows.map(([l, r]) => `| ${esc(l)} | ${esc(r)} |`),
            ].join("\n"),
          );
        } else {
          const header =
            n.header && (n.header[0] || n.header[1]) ? [`${n.header[0]} — ${n.header[1]}`] : [];
          blocks.push([...header, ...n.rows.map(([l, r]) => `${t(l)} — ${t(r)}`)].join("\n"));
        }
        break;
      case "image": {
        const label = [n.alt, n.caption].filter(Boolean).join(" — ");
        blocks.push(md ? `*[Image: ${label}]*` : `[Image: ${t(label)}]`);
        break;
      }
    }
  }
  return blocks.join("\n\n");
}

/** Plain text (default) or Markdown representation of a module, for search, previews and AI. */
export function moduleToText(config: unknown, options: ToTextOptions = {}): string {
  return renderNodes(moduleToTextNodes(config, options), resolve(options));
}

/** The whole lesson as text: title, description, objectives, then every module in order. */
export function lessonToText(lesson: unknown, options: ToTextOptions = {}): string {
  const o = resolve(options);
  if (typeof lesson !== "object" || lesson === null) return "";
  const l = lesson as {
    title?: unknown;
    description?: unknown;
    objectives?: unknown;
    modules?: unknown;
  };
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const head: TextNode[] = [
    ...heading(1, str(l.title)),
    ...paragraph(str(l.description)),
    ...list(Array.isArray(l.objectives) ? l.objectives.map(str) : []),
  ];
  const parts = [renderNodes(head, o)];
  if (Array.isArray(l.modules))
    for (const m of l.modules) parts.push(renderNodes(moduleToTextNodes(m, options), o));
  return parts.filter(Boolean).join("\n\n");
}
