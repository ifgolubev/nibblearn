/**
 * Minimal, safe inline markup parser. Supports **bold**, *italic*, `code`
 * and newlines. Produces tokens so renderers never inject HTML.
 */
export type InlineToken =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "code"; value: string }
  | { kind: "break" };

const pattern = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`]+)`|\n)/g;

export function parseInlineMarkup(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const idx = m.index ?? 0;
    if (idx > last) tokens.push({ kind: "text", value: text.slice(last, idx) });
    if (m[2] !== undefined) tokens.push({ kind: "bold", value: m[2] });
    else if (m[3] !== undefined) tokens.push({ kind: "italic", value: m[3] });
    else if (m[4] !== undefined) tokens.push({ kind: "code", value: m[4] });
    else tokens.push({ kind: "break" });
    last = idx + m[0].length;
  }
  if (last < text.length) tokens.push({ kind: "text", value: text.slice(last) });
  return tokens;
}

/** Split text into paragraphs on blank lines. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Strip markup for plain-text contexts (aria-labels etc.). */
export function stripMarkup(text: string): string {
  return parseInlineMarkup(text)
    .map((t) => (t.kind === "break" ? " " : t.value))
    .join("");
}
