import { en, type MessageKey, type Messages } from "./en";

export type { MessageKey, Messages };
export { en };

/** Built-in UI locales. English ships by default; pass other languages through `messages`. */
export const locales: Record<string, Messages> = { en };

export type MessageValues = Record<string, string | number>;

/** Interpolate `{name}` placeholders. */
export function formatMessage(template: string, values?: MessageValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in values ? String(values[k]) : `{${k}}`,
  );
}

/** Resolve messages for a locale with English fallbacks and optional overrides. */
export function resolveMessages(locale = "en", overrides?: Partial<Messages>): Messages {
  const base = locales[locale] ?? locales[locale.split("-")[0] ?? "en"] ?? en;
  return { ...en, ...base, ...(overrides ?? {}) };
}

export function createTranslator(messages: Messages) {
  return (key: MessageKey | (string & {}), values?: MessageValues): string =>
    formatMessage(messages[key] ?? key, values);
}
export type Translator = ReturnType<typeof createTranslator>;
