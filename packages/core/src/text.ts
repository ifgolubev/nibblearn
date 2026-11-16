/**
 * Minimal, safe inline markup parser. Supports **bold**, *italic*, `code`, [links](https://…)
 * and newlines. Produces tokens so renderers never inject HTML.
 */
export type InlineToken =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "code"; value: string }
  | { kind: "link"; value: string; href: string }
  | { kind: "break" };

// Link label and target are length-limited so a run of "[" or "(" cannot make matching
// quadratic on untrusted text.
const pattern =
  /(\[([^\]\n]{1,500})\]\(([^()\s]{1,2048})\)|\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`]+)`|\n)/g;

/**
 * Link targets content may use: http(s), mailto:, tel:, and same-site paths (`/…`, `#…`).
 * Everything else (`javascript:`, `data:`, protocol-relative `//host`…) is rendered as text.
 */
export function isSafeLinkHref(href: string): boolean {
  const v = href.trim();
  if (!v || v !== href) return false;
  for (let i = 0; i < v.length; i++)
    if (v.charCodeAt(i) < 0x20 || v.charCodeAt(i) === 0x7f) return false;
  if (v.startsWith("#")) return true;
  if (v.startsWith("/")) return !v.startsWith("//") && !v.startsWith("/\\");
  return /^(?:https?:\/\/[^\s/]|mailto:[^\s]|tel:[+\d])/i.test(v);
}

export function parseInlineMarkup(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const idx = m.index ?? 0;
    if (idx > last) tokens.push({ kind: "text", value: text.slice(last, idx) });
    if (m[2] !== undefined) {
      // An unsafe target keeps the markup as plain text, exactly as written.
      if (isSafeLinkHref(m[3]!)) tokens.push({ kind: "link", value: m[2], href: m[3]! });
      else tokens.push({ kind: "text", value: m[0] });
    } else if (m[4] !== undefined) tokens.push({ kind: "bold", value: m[4] });
    else if (m[5] !== undefined) tokens.push({ kind: "italic", value: m[5] });
    else if (m[6] !== undefined) tokens.push({ kind: "code", value: m[6] });
    else tokens.push({ kind: "break" });
    last = idx + m[0].length;
  }
  if (last < text.length) tokens.push({ kind: "text", value: text.slice(last) });
  return tokens;
}

/** Line breaks as `\n` (CRLF and CR from pasted or Windows text). */
const normalizeNewlines = (text: string) => text.replace(/\r\n?/g, "\n");

/** Split text into paragraphs on blank lines. */
export function splitParagraphs(text: string): string[] {
  return normalizeNewlines(text)
    .split(/\n[^\S\n]*\n\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** A paragraph or a list, from `parseBlocks`. */
export type TextBlock =
  | { kind: "paragraph"; text: string }
  /** `start`: the number of the first item of an ordered list, when it is not 1. */
  | { kind: "list"; ordered: boolean; items: string[]; start?: number };

// `[^\n]*` always reaches the end of a line, so a failed match never backtracks over spaces.
const BULLET = /^[^\S\n]*[-*][^\S\n]+([^\n]*)$/;
const NUMBERED = /^[^\S\n]*(\d{1,3})[.)][^\S\n]+([^\n]*)$/;

/**
 * Split block text into paragraphs and lists. A list is a run of lines starting with
 * `- `, `* ` or `1. ` / `1) `; a following line without a marker continues the item.
 */
export function parseBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  for (const para of splitParagraphs(text)) {
    const lines = para.split("\n");
    let buffer: string[] = [];
    let list: { ordered: boolean; items: string[]; start?: number } | null = null;
    const flushText = () => {
      if (buffer.length) blocks.push({ kind: "paragraph", text: buffer.join("\n") });
      buffer = [];
    };
    const flushList = () => {
      if (list) blocks.push({ kind: "list", ...list });
      list = null;
    };
    for (const line of lines) {
      const bullet = BULLET.exec(line);
      const numbered = bullet ? null : NUMBERED.exec(line);
      if (bullet || numbered) {
        const ordered = Boolean(numbered);
        flushText();
        if (list && list.ordered !== ordered) flushList();
        if (!list) {
          // Keep the author's numbering ("3. …" after a paragraph, or items split by blank lines).
          const start = numbered ? Number(numbered[1]) : 1;
          list = { ordered, items: [], ...(ordered && start !== 1 ? { start } : {}) };
        }
        list.items.push(bullet ? bullet[1]! : numbered![2]!);
      } else if (list && line.trim()) {
        list.items[list.items.length - 1] += `\n${line.trim()}`;
      } else {
        flushList();
        buffer.push(line);
      }
    }
    flushText();
    flushList();
  }
  return blocks;
}

/** Strip markup for plain-text contexts (aria-labels etc.). */
export function stripMarkup(text: string): string {
  return parseInlineMarkup(text)
    .map((t) => (t.kind === "break" ? " " : t.value))
    .join("");
}
