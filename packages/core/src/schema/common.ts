import { z } from "zod";

/** A short identifier. Letters, numbers, dashes and underscores. */
export const idSchema = z
  .string()
  .min(1, "id must not be empty")
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/, "id may only contain letters, numbers, '-' and '_'");

/**
 * Plain text that may contain a tiny, safe inline markup subset:
 * **bold**, *italic*, `code` and line breaks. HTML is never interpreted.
 */
export const textSchema = z.string().max(4000);

/**
 * A CSS colour that is safe to place into a style: a named colour or design-token name
 * (letters, digits and dashes), a hex colour, or a functional colour such as
 * `rgb(…)`, `hsl(…)`, `oklch(…)`. Anything else — in particular `url(…)`, `var(…)`,
 * `;` or nested functions — is rejected so untrusted lesson JSON cannot make the
 * browser request external resources through styles.
 */
export const SAFE_CSS_COLOR =
  /^(?:#[0-9a-fA-F]{3,8}|[a-zA-Z][a-zA-Z0-9-]{0,39}|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\([0-9a-zA-Z.,%\s/+-]{1,60}\))$/;

export function isSafeCssColor(value: string): boolean {
  return SAFE_CSS_COLOR.test(value.trim());
}

export const cssColorSchema = z.string().max(80).refine(isSafeCssColor, {
  message:
    "must be a plain CSS colour (name, token, #hex, rgb(), hsl(), oklch()…); url(), var() and other functions are not allowed",
});

/** A font-family list: letters, digits, spaces, commas, quotes, dashes and underscores only. */
export const SAFE_FONT_FAMILY = /^[a-zA-Z0-9 ,'"_-]{1,200}$/;

export const fontFamilySchema = z.string().max(200).regex(SAFE_FONT_FAMILY, {
  message: "font family may only contain letters, digits, spaces, commas, quotes, '-' and '_'",
});

/**
 * Image URLs: http(s), protocol-relative, relative paths, `blob:` and `data:image/*`.
 * Script-capable schemes (`javascript:`, `vbscript:`, `data:text/html`, …) are rejected.
 */
export function isSafeImageSrc(value: string): boolean {
  const v = value.trim();
  if (v.length === 0) return false;
  // Reject control characters (tabs/newlines inside a scheme are a classic filter bypass).
  for (let i = 0; i < v.length; i++) if (v.charCodeAt(i) < 0x20) return false;
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(v)?.[1]?.toLowerCase();
  if (!scheme) return true; // relative or protocol-relative URL
  if (scheme === "http" || scheme === "https" || scheme === "blob") return true;
  if (scheme === "data") return /^data:image\/(?:png|jpe?g|gif|webp|avif|svg\+xml)[;,]/i.test(v);
  return false;
}

export const imageSrcSchema = z.string().min(1).refine(isSafeImageSrc, {
  message: "image src must be an http(s), relative, blob: or data:image/* URL",
});

export const mediaSchema = z.object({
  /** Image URL (absolute, relative or data:image URI). */
  src: imageSrcSchema,
  /** Alternative text for screen readers. Use an empty string for decorative images. */
  alt: z.string().default(""),
  /** Optional intrinsic size, used to reserve space and avoid layout shift. */
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  /** Optional caption rendered under the image. */
  caption: z.string().optional(),
});
export type Media = z.infer<typeof mediaSchema>;

export const feedbackSchema = z
  .object({
    /** Shown when the learner answers correctly. */
    correct: textSchema.optional(),
    /** Shown when the learner answers incorrectly. */
    incorrect: textSchema.optional(),
    /** Shown when the module is completed. */
    complete: textSchema.optional(),
  })
  .default({});
export type FeedbackConfig = z.infer<typeof feedbackSchema>;

export const scoringSchema = z
  .object({
    /** Relative weight of this module in the lesson score. Default 1. */
    weight: z.number().min(0).default(1),
    /** Minimum score (0–1) to consider the module passed. Default 0 (any completion passes). */
    passThreshold: z.number().min(0).max(1).default(0),
  })
  .default({ weight: 1, passThreshold: 0 });
export type Scoring = z.infer<typeof scoringSchema>;

export const appearanceSchema = z
  .object({
    /** Override the accent color for this module only (a plain CSS color, see `cssColorSchema`). */
    accent: cssColorSchema.optional(),
    /** Denser layout for embedding in constrained spaces. */
    compact: z.boolean().default(false),
    /** Hide the module title/instructions header. */
    hideHeader: z.boolean().default(false),
  })
  .default({ compact: false, hideHeader: false });
export type Appearance = z.infer<typeof appearanceSchema>;

/** Fields shared by every module. */
export const moduleBaseShape = {
  id: idSchema,
  /** Shown as the module heading. */
  title: z.string().max(200).optional(),
  /** Short instruction shown under the title. */
  instructions: textSchema.optional(),
  feedback: feedbackSchema,
  scoring: scoringSchema,
  appearance: appearanceSchema,
  /** Free-form metadata, ignored by Nibblearn. */
  meta: z.record(z.string(), z.unknown()).optional(),
};

/** Shared behaviour toggles used by many practice modules. */
export const retryBehaviorShape = {
  /** Allow the learner to try again after an incorrect answer. */
  allowRetry: z.boolean().default(true),
  /** Maximum attempts before the correct answer is revealed. 0 = unlimited. */
  maxAttempts: z.number().int().min(0).default(0),
  /** Show explanations after checking an answer. */
  showExplanation: z.boolean().default(true),
};
