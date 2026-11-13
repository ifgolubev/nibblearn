import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from "react";
import {
  createTranslator,
  resolveMessages,
  type EventHandler,
  type NibblearnEvent,
  type NibblearnEventType,
  type Messages,
  type Translator,
} from "@nibblearn/core";
import { MotionConfig } from "motion/react";

export type ThemeMode = "light" | "dark" | "system";

export interface NibblearnConfig {
  /** UI locale (BCP-47). English is built in; provide other languages via `messages`. */
  locale: string;
  messages: Messages;
  t: Translator;
  theme: ThemeMode;
  /** Force reduced motion regardless of OS preference. */
  reducedMotion: boolean;
  /** Emit a Nibblearn event to all registered handlers. */
  emit: (type: NibblearnEventType, data?: Omit<NibblearnEvent, "type" | "timestamp">) => void;
}

const defaultConfig: NibblearnConfig = {
  locale: "en",
  messages: resolveMessages("en"),
  t: createTranslator(resolveMessages("en")),
  theme: "system",
  reducedMotion: false,
  emit: () => {},
};

const NibblearnContext = createContext<NibblearnConfig>(defaultConfig);

export interface NibblearnProviderProps {
  children: ReactNode;
  /** UI locale, default "en". */
  locale?: string;
  /** Override or extend UI strings. */
  messages?: Partial<Messages>;
  /** "light" | "dark" | "system" (default). */
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
  /** Extra CSS class for the root element. */
  className?: string;
  style?: CSSProperties;
}

/**
 * Optional provider for locale, theme and events. Modules work without it;
 * use it when you want shared settings for many modules or a LessonPlayer.
 */
export function NibblearnProvider({
  children,
  locale = "en",
  messages: overrides,
  theme = "system",
  accent,
  radius,
  fontFamily,
  reducedMotion = false,
  onEvent,
  className,
  style,
}: NibblearnProviderProps) {
  const value = useMemo<NibblearnConfig>(() => {
    const messages = resolveMessages(locale, overrides);
    return {
      locale,
      messages,
      t: createTranslator(messages),
      theme,
      reducedMotion,
      emit: (type, data) => {
        onEvent?.({ type, timestamp: new Date().toISOString(), ...data });
      },
    };
  }, [locale, overrides, theme, reducedMotion, onEvent]);

  const rootStyle = useMemo(() => {
    const s: Record<string, string> & CSSProperties = { ...(style as Record<string, string>) };
    if (accent) s["--nb-accent"] = accent;
    if (typeof radius === "number") {
      s["--nb-radius-sm"] = `${Math.max(0, radius - 4)}px`;
      s["--nb-radius-md"] = `${radius}px`;
      s["--nb-radius-lg"] = `${radius + 4}px`;
      s["--nb-radius-xl"] = `${radius + 12}px`;
    }
    if (fontFamily) s["--nb-font"] = fontFamily;
    return s;
  }, [accent, radius, fontFamily, style]);

  return (
    <NibblearnContext.Provider value={value}>
      <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
        <div
          className={["nb-root", "nb-provider", className].filter(Boolean).join(" ")}
          data-nb-theme={theme}
          data-nb-motion={reducedMotion ? "reduced" : undefined}
          style={rootStyle}
        >
          {children}
        </div>
      </MotionConfig>
    </NibblearnContext.Provider>
  );
}

export function useNibblearn(): NibblearnConfig {
  return useContext(NibblearnContext);
}

/** Translate a message key with placeholders. */
export function useTranslator(): Translator {
  return useContext(NibblearnContext).t;
}

export const NibblearnContextInternal = NibblearnContext;
