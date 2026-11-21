import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  createTranslator,
  accentTextColors,
  readableTextColor,
  resolveMessages,
  type EventHandler,
  type NibblearnEvent,
  type NibblearnEventType,
  type Messages,
  type Translator,
} from "@nibblearn/core";
import { MotionConfig } from "motion/react";

export type ThemeMode = "light" | "dark" | "system";

/**
 * Turns an image `src` from lesson content into a URL to load. Called for every image inside
 * the provider; return `null`/`undefined` to keep the original value. Typical use: content
 * stores `asset:<file key>` and the resolver returns a (temporary) signed URL.
 */
export type AssetResolver = (
  src: string,
  context: { reason: "initial" | "retry" },
) => string | null | undefined | Promise<string | null | undefined>;

/** @internal Outcome of one resolver call. */
export type AssetResolution = { kind: "url"; url: string } | { kind: "keep" } | { kind: "failed" };

/** @internal Per-provider cache of resolved image URLs. */
export interface AssetCache {
  values: Map<string, string>;
  pending: Map<string, Promise<AssetResolution>>;
}

const createAssetCache = (): AssetCache => ({ values: new Map(), pending: new Map() });

export interface NibblearnConfig {
  /** UI locale (BCP-47). English is built in; provide other languages via `messages`. */
  locale: string;
  messages: Messages;
  t: Translator;
  theme: ThemeMode;
  /**
   * The theme set explicitly on a provider, or undefined for the default. Roots only stamp
   * `data-nb-theme` when it is set, so a `.dark` ancestor still switches default modules.
   */
  themeAttr?: ThemeMode;
  /** Force reduced motion regardless of OS preference. */
  reducedMotion: boolean;
  /** Emit a Nibblearn event to all registered handlers. */
  emit: (type: NibblearnEventType, data?: Omit<NibblearnEvent, "type" | "timestamp">) => void;
  /**
   * CSS custom properties from the provider (accent, radius, font). Every module and player
   * root applies them inline, because each root re-declares the default tokens.
   */
  themeVars: Readonly<Record<string, string>>;
  /** Image resolver from the provider, if any. */
  resolveAsset?: AssetResolver;
  /** How modules show their end state. See `CompletionMode`. */
  completion?: CompletionMode;
  /** @internal */
  assetCache: AssetCache;
}

/** What a module would show on its completion card. */
export interface CompletionInfo {
  title: string;
  /** May contain inline markup. */
  text?: string;
  /** 0–1, when the module is scored. */
  score?: number;
  /** False only when the module is scored and the score is below its pass threshold. */
  passed: boolean;
  stats: { label: string; value: ReactNode }[];
  /** Starts the module again, when it can be retried. */
  onRetry?: () => void;
}

/**
 * "card" (default) shows the built-in completion card. "hidden" shows nothing, for hosts that
 * present results themselves (use `onComplete`). A function renders your own end state.
 */
export type CompletionMode = "card" | "hidden" | ((info: CompletionInfo) => ReactNode);

const defaultConfig: NibblearnConfig = {
  locale: "en",
  messages: resolveMessages("en"),
  t: createTranslator(resolveMessages("en")),
  theme: "light",
  reducedMotion: false,
  emit: () => {},
  themeVars: {},
  assetCache: createAssetCache(),
};

const NibblearnContext = createContext<NibblearnConfig>(defaultConfig);

export interface NibblearnProviderProps {
  children: ReactNode;
  /** UI locale, default "en". */
  locale?: string;
  /** Override or extend UI strings. */
  messages?: Partial<Messages>;
  /**
   * "light" (default) | "dark" | "system". "system" follows the OS preference; choose it only
   * when your page has a dark theme too.
   */
  theme?: ThemeMode;
  /** Accent color override (any CSS color). */
  accent?: string;
  /** Base corner radius in px. */
  radius?: number;
  /** Font family override. */
  fontFamily?: string;
  /** Force reduced motion. Defaults to the OS preference. */
  reducedMotion?: boolean;
  /** Receives every Nibblearn event. */
  onEvent?: EventHandler;
  /** Resolve image `src` values (for example `asset:<key>`) to URLs. See `AssetResolver`. */
  resolveAsset?: AssetResolver;
  /**
   * Replace or hide the completion card of every module inside. Inherited from an outer
   * provider when omitted. Pass a stable function (not an inline arrow) to avoid re-renders.
   */
  completion?: CompletionMode;
  /**
   * Render a wrapper element (default true). The wrapper only carries design tokens and theme
   * attributes; it does not restyle your content. With `false` the provider adds no DOM at all,
   * and `className` / `style` are ignored.
   */
  wrapper?: boolean;
  /** Extra CSS class for the wrapper element. */
  className?: string;
  style?: CSSProperties;
  /**
   * @internal Theme variables inherited from an outer provider (used by `LessonPlayer`);
   * this provider's own accent, radius and font take precedence.
   */
  inheritThemeVars?: Readonly<Record<string, string>>;
}

/**
 * Optional provider for locale, theme and events. Modules work without it;
 * use it when you want shared settings for many modules or a LessonPlayer.
 */
export function NibblearnProvider({
  children,
  locale = "en",
  messages: overrides,
  theme: themeProp,
  accent,
  radius,
  fontFamily,
  reducedMotion = false,
  onEvent,
  resolveAsset,
  completion: completionProp,
  wrapper = true,
  className,
  style,
  inheritThemeVars,
}: NibblearnProviderProps) {
  const theme = themeProp ?? "light";
  const themeVars = useMemo(() => {
    const s: Record<string, string> = { ...inheritThemeVars };
    if (accent) {
      s["--nb-accent"] = accent;
      // Inherited text colours belong to the inherited accent.
      delete s["--nb-accent-fg"];
      delete s["--nb-accent-soft-fg-light"];
      delete s["--nb-accent-soft-fg-dark"];
      const fg = readableTextColor(accent);
      if (fg) s["--nb-accent-fg"] = fg;
      const soft = accentTextColors(accent);
      if (soft) {
        s["--nb-accent-soft-fg-light"] = soft.light;
        s["--nb-accent-soft-fg-dark"] = soft.dark;
      }
    }
    if (typeof radius === "number") {
      s["--nb-radius-sm"] = `${Math.max(0, radius - 4)}px`;
      s["--nb-radius-md"] = `${radius}px`;
      s["--nb-radius-lg"] = `${radius + 4}px`;
      s["--nb-radius-xl"] = `${radius + 12}px`;
    }
    if (fontFamily) s["--nb-font"] = fontFamily;
    return s;
  }, [accent, radius, fontFamily, inheritThemeVars]);

  // One cache per provider. The resolver is called through a ref, so an inline function
  // (a new identity on every render) neither empties the cache nor re-resolves every image.
  // To start fresh with another resolver, remount the provider (change its `key`).
  const resolverRef = useRef(resolveAsset);
  useEffect(() => {
    resolverRef.current = resolveAsset;
  }, [resolveAsset]);
  const hasResolver = resolveAsset !== undefined;
  const stableResolveAsset = useMemo<AssetResolver | undefined>(
    () => (hasResolver ? (src, ctx) => resolverRef.current!(src, ctx) : undefined),
    [hasResolver],
  );
  const assetCache = useMemo(() => createAssetCache(), []);
  const inheritedCompletion = useContext(NibblearnContext).completion;
  const completion = completionProp ?? inheritedCompletion;

  const value = useMemo<NibblearnConfig>(() => {
    const messages = resolveMessages(locale, overrides);
    return {
      locale,
      messages,
      t: createTranslator(messages),
      theme,
      themeAttr: themeProp,
      reducedMotion,
      emit: (type, data) => {
        onEvent?.({ type, timestamp: new Date().toISOString(), ...data });
      },
      themeVars,
      resolveAsset: stableResolveAsset,
      completion,
      assetCache,
    };
  }, [
    locale,
    overrides,
    theme,
    themeProp,
    reducedMotion,
    onEvent,
    themeVars,
    stableResolveAsset,
    completion,
    assetCache,
  ]);

  const ignoredWrapperProps = !wrapper && (className !== undefined || style !== undefined);
  useEffect(() => {
    if (ignoredWrapperProps && isDev())
      console.warn("NibblearnProvider: className and style are ignored when wrapper={false}.");
  }, [ignoredWrapperProps]);

  return (
    <NibblearnContext.Provider value={value}>
      <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
        {wrapper ? (
          <div
            className={["nb-provider", "nb-theme", className].filter(Boolean).join(" ")}
            data-nb-theme={themeProp}
            data-nb-motion={reducedMotion ? "reduced" : undefined}
            style={{ ...themeVars, ...style }}
          >
            {children}
          </div>
        ) : (
          children
        )}
      </MotionConfig>
    </NibblearnContext.Provider>
  );
}

function isDev(): boolean {
  const env = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env;
  return env?.NODE_ENV !== "production";
}

export function useNibblearn(): NibblearnConfig {
  return useContext(NibblearnContext);
}

/** Translate a message key with placeholders. */
export function useTranslator(): Translator {
  return useContext(NibblearnContext).t;
}

export const NibblearnContextInternal = NibblearnContext;
