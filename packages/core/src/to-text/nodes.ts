import type { SchemaRegistry } from "../schema/registry";

export interface ToTextOptions {
  /** "text" (default): plain text without markup. "markdown": Markdown with inline markup kept. */
  format?: "text" | "markdown";
  /** Include correct answers (correct options, true/false values, solutions). Default false. */
  includeAnswers?: boolean;
  /** Include explanations, hints and feedback texts. Default false. */
  includeFeedback?: boolean;
  /** Registry used to resolve module types. Defaults to the built-in modules. */
  registry?: SchemaRegistry;
}

/** A format-neutral piece of a module's content. */
export type TextNode =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[]; start?: number }
  | {
      kind: "question";
      prompt: string;
      options?: { text: string; correct?: boolean }[];
      answer?: string;
      explanation?: string;
    }
  | { kind: "pairs"; header?: [string, string]; rows: [string, string][] }
  | { kind: "image"; alt: string; caption?: string };

/** Turns a parsed module config into text nodes. */
export type TextSerializer<C = never> = (config: C, options: ResolvedToTextOptions) => TextNode[];

export interface ResolvedToTextOptions {
  format: "text" | "markdown";
  includeAnswers: boolean;
  includeFeedback: boolean;
}

// ---- small builders shared by serializers -------------------------------------------------

type Maybe = string | null | undefined;

export const heading = (level: 1 | 2 | 3, text: Maybe): TextNode[] =>
  text ? [{ kind: "heading", level, text }] : [];

export const paragraph = (text: Maybe): TextNode[] => (text ? [{ kind: "paragraph", text }] : []);

export const list = (items: Maybe[], ordered = false): TextNode[] => {
  const clean = items.filter((i): i is string => !!i);
  return clean.length ? [{ kind: "list", ordered, items: clean }] : [];
};

export const image = (media: { alt?: string; caption?: string } | null | undefined): TextNode[] =>
  media && (media.alt || media.caption)
    ? [{ kind: "image", alt: media.alt ?? "", caption: media.caption }]
    : [];

/** "Label: text", or just one of them. */
export const labelled = (label: Maybe, text: Maybe): string | undefined =>
  label && text ? `${label}: ${text}` : label || text || undefined;

/** Feedback-like text, only when `includeFeedback` is on. */
export const feedback = (o: ResolvedToTextOptions, label: string, text: Maybe): TextNode[] =>
  o.includeFeedback && text
    ? [{ kind: "paragraph", text: label ? `${label}: ${text}` : text }]
    : [];

/** Answer-like text, only when `includeAnswers` is on. */
export const answer = (o: ResolvedToTextOptions, label: string, text: Maybe): TextNode[] =>
  o.includeAnswers && text ? [{ kind: "paragraph", text: label ? `${label}: ${text}` : text }] : [];
