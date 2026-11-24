import { z } from "zod";
import { isSafeLinkHref } from "../text";

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

/** Longer text for content blocks (accordion panels, tabs, slides, columns, callouts). */
export const longTextSchema = z.string().max(20000);

/** When a content block counts as completed: as soon as it is shown, or once every part was opened. */
export const completeOnSchema = z.enum(["view", "all-items"]).default("view");

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

export const cssColorSchema = z
  .string()
  .max(80)
  .refine(isSafeCssColor, {
    message:
      "must be a plain CSS colour (name, token, #hex, rgb(), hsl(), oklch()…); url(), var() and other functions are not allowed",
  })
  // JSON Schema has no `trim()`, so the exported pattern rejects surrounding spaces.
  .meta({ pattern: SAFE_CSS_COLOR.source });

/** A font-family list: letters, digits, spaces, commas, quotes, dashes and underscores only. */
export const SAFE_FONT_FAMILY = /^[a-zA-Z0-9 ,'"_-]{1,200}$/;

export const fontFamilySchema = z.string().max(200).regex(SAFE_FONT_FAMILY, {
  message: "font family may only contain letters, digits, spaces, commas, quotes, '-' and '_'",
});

/** Key of an `asset:` image reference, resolved by the host (see `resolveAsset`). */
export const ASSET_KEY = /^[A-Za-z0-9._~/%:@+=-]{1,512}$/;

/**
 * Image URLs: http(s), protocol-relative, relative paths, `blob:` and `data:image/*`, plus
 * `asset:<key>` references that the host resolves to a URL at render time.
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
  if (scheme === "asset") return ASSET_KEY.test(v.slice("asset:".length));
  return false;
}

/**
 * A regular expression (as a string, without flags) equivalent to `isSafeImageSrc()`, for
 * JSON Schema validators on other platforms. Kept in sync by a table-driven test.
 */
export const SAFE_IMAGE_SRC_PATTERN = [
  "^\\s*(?=\\S)(?:(?:",
  // relative or protocol-relative: anything that does not start with a URL scheme
  "(?![a-zA-Z][a-zA-Z0-9+.-]*:)",
  "|[Hh][Tt][Tt][Pp][Ss]?:",
  "|[Bb][Ll][Oo][Bb]:",
  "|[Dd][Aa][Tt][Aa]:[Ii][Mm][Aa][Gg][Ee]/(?:[Pp][Nn][Gg]|[Jj][Pp][Ee]?[Gg]|[Gg][Ii][Ff]|[Ww][Ee][Bb][Pp]|[Aa][Vv][Ii][Ff]|[Ss][Vv][Gg]\\+[Xx][Mm][Ll])[;,]",
  // The body is matched atomically (a lookahead capture plus a backreference), so a long
  // value followed by an invalid character fails in linear time instead of backtracking.
  ")(?=([^\\u0000-\\u001f]*))\\1",
  // asset:<key> — the key has a restricted alphabet and nothing may follow it
  "|[Aa][Ss][Ss][Ee][Tt]:[A-Za-z0-9._~/%:@+=-]{1,512}",
  ")\\s*$",
].join("");

export const imageSrcSchema = z
  .string()
  .min(1)
  .refine(isSafeImageSrc, {
    message: "image src must be an http(s), relative, blob:, data:image/* or asset:<key> URL",
  })
  .meta({ pattern: SAFE_IMAGE_SRC_PATTERN });

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

/**
 * Video and caption-file URLs: http(s), protocol-relative, relative paths, `blob:` and
 * `asset:<key>` references. `data:` URIs and script-capable schemes are rejected.
 */
export function isSafeVideoSrc(value: string): boolean {
  return isSafeImageSrc(value) && !/^\s*data:/i.test(value);
}

/** A regular expression (as a string) equivalent to `isSafeVideoSrc()`, for JSON Schema validators. */
export const SAFE_VIDEO_SRC_PATTERN = [
  "^\\s*(?=\\S)(?:(?:",
  "(?![a-zA-Z][a-zA-Z0-9+.-]*:)",
  "|[Hh][Tt][Tt][Pp][Ss]?:",
  "|[Bb][Ll][Oo][Bb]:",
  ")(?=([^\\u0000-\\u001f]*))\\1",
  "|[Aa][Ss][Ss][Ee][Tt]:[A-Za-z0-9._~/%:@+=-]{1,512}",
  ")\\s*$",
].join("");

const videoSrc = (title: string) =>
  z
    .string()
    .min(1)
    .max(2048)
    .refine(isSafeVideoSrc, {
      message: "must be an http(s), relative, blob: or asset:<key> URL",
    })
    .meta({ pattern: SAFE_VIDEO_SRC_PATTERN, title });

export const videoSrcSchema = videoSrc("Video URL");

/** A regular expression (as a string) equivalent to `isSafeLinkHref()`, for JSON Schema validators. */
export const SAFE_LINK_HREF_PATTERN = [
  "^(?!\\s)(?![\\s\\S]*\\s$)(?:",
  "#",
  "|/(?![/\\\\])",
  "|[Hh][Tt][Tt][Pp][Ss]?://[^\\s/]",
  "|[Mm][Aa][Ii][Ll][Tt][Oo]:\\S",
  "|[Tt][Ee][Ll]:[+\\d]",
  ")[^\\u0000-\\u001f\\u007f]*$",
].join("");

/** A link target content may use: http(s), `mailto:`, `tel:`, or a same-site path (`/…`, `#…`). */
export const linkHrefSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine(isSafeLinkHref, {
    message: "link must be an http(s), mailto:, tel: or same-site (/path, #anchor) URL",
  })
  .meta({ pattern: SAFE_LINK_HREF_PATTERN, title: "Link URL" });

/** A self-hosted video file played with the browser's native controls. It never autoplays. */
export const videoSchema = z.object({
  /** Video file URL (mp4 or webm; absolute, relative or an asset: reference). */
  src: videoSrcSchema,
  /** Image shown before playback starts. */
  poster: imageSrcSchema.optional(),
  /** Short name of the video, announced by screen readers. */
  title: z.string().max(200).optional(),
  /** Captions file in WebVTT format. Provide it whenever the video has speech. */
  captions: z
    .object({
      /** WebVTT file URL. Must be same-origin or served with CORS headers. */
      src: videoSrc("Captions file URL"),
      /** Language code of the captions, e.g. "en". */
      lang: z
        .string()
        .max(35)
        .regex(/^[a-zA-Z0-9-]+$/)
        .optional(),
      /** Name shown in the player's captions menu. */
      label: z.string().max(80).optional(),
    })
    .optional(),
});
export type Video = z.infer<typeof videoSchema>;

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
    /** Minimum score (0–1) to consider the module passed. 0 (the default) means 0.7. */
    passThreshold: z.number().min(0).max(1).default(0),
    /**
     * When the correct answers may be shown. "always": as soon as an answer is checked.
     * "after-pass": only once the module is completed with a score that reaches the pass
     * threshold (0.7 when none is set). "never": not at all. The learner always sees which of their answers are wrong.
     */
    revealAnswers: z.enum(["always", "after-pass", "never"]).default("always"),
  })
  .default({ weight: 1, passThreshold: 0, revealAnswers: "always" });
export type Scoring = z.infer<typeof scoringSchema>;

export const appearanceSchema = z
  .object({
    /** Accent color for this block only, e.g. `#3b5bdb` or `teal`. */
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
  /** Schema version of this module config. Omitted means 1. See `migrateModule()`. */
  schemaVersion: z.number().int().min(1).optional(),
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
