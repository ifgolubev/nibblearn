import {
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { carouselSchema, type CarouselConfig } from "@nibblearn/core";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useAnnounce } from "../../hooks/useAnnounce";
import { useFocusSync } from "../../hooks/useFocusSync";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { usePersistedState } from "../../hooks/usePersistedState";
import * as G from "../../hooks/stateGuards";
import { InvalidModule, ModuleShell } from "../../primitives/ModuleShell";
import { RichText } from "../../primitives/RichText";
import { SafeImage } from "../../primitives/SafeImage";
import { runKey } from "../runKey";
import type { ModuleProps } from "../types";
import { useBlockCompletion } from "../useBlockCompletion";
import "./carousel.css";

export type CarouselProps = ModuleProps<CarouselConfig>;

const SWIPE_PX = 40;

/** Slides with text and images, moved by buttons, dots, arrow keys or swipe. Never auto-advances. */
export function Carousel({ config: rawConfig, ...rest }: CarouselProps) {
  const parsed = useMemo(() => carouselSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success)
    return (
      <InvalidModule
        type="carousel"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  return <CarouselInner config={parsed.data} {...rest} />;
}

function CarouselInner(props: CarouselProps) {
  const { config, onComplete, onEvent, resetKey, initialState, onStateChange, mode, focus } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "carousel",
    onComplete,
    onEvent,
    resetKey,
    config,
    initialState,
    onStateChange,
    mode,
    focus,
  });
  return <CarouselRun key={runKey(life, config)} {...props} life={life} />;
}

function CarouselRun({
  config,
  life,
  hideHeader,
  className,
}: CarouselProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const { message, announce } = useAnnounce();
  const { slides } = config.content;
  const { loop, showDots, completeOn } = config.behavior;
  const ids = slides.map((s) => s.id);
  const total = slides.length;
  const startX = useRef<number | null>(null);

  // Progress is saved in the state snapshot (initialState / onStateChange).
  const [index, setIndex] = usePersistedState(life, "index", 0, G.int(0, total - 1));
  const [seen, setSeen] = usePersistedState<string[]>(
    life,
    "seen",
    () => [ids[0]!],
    G.arrayOf(G.oneOf(ids), total),
  );
  useFocusSync(life, ["content", "slides"], total, (i) => setIndex(i));
  useBlockCompletion(life, completeOn, seen.length, total);

  const go = (to: number, via: string) => {
    const next = loop ? (to + total) % total : Math.max(0, Math.min(total - 1, to));
    if (next === index) return;
    setIndex(next);
    const id = ids[next]!;
    setSeen((prev) => (prev.includes(id) ? prev : [...prev, id]));
    life.emit("module:interact", { action: "slide", itemId: id, itemIndex: next, via });
    announce(t("carousel.slide", { current: next + 1, total }));
  };
  const canPrev = loop || index > 0;
  const canNext = loop || index < total - 1;

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" && canNext) {
      e.preventDefault();
      go(index + 1, "key");
    } else if (e.key === "ArrowLeft" && canPrev) {
      e.preventDefault();
      go(index - 1, "key");
    }
  };
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse") startX.current = e.clientX;
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (dx <= -SWIPE_PX && canNext) go(index + 1, "swipe");
    else if (dx >= SWIPE_PX && canPrev) go(index - 1, "swipe");
  };

  const slide = slides[index]!;
  const slideLabel = t("carousel.slide", { current: index + 1, total });
  return (
    <ModuleShell
      type="carousel"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : config.instructions}
      appearance={config.appearance}
      className={className}
      announcement={message}
      aside={<span className="nb-counter">{slideLabel}</span>}
    >
      <div
        className="nb-carousel"
        role="group"
        aria-roledescription="carousel"
        aria-label={config.title ?? t("carousel.label")}
        onKeyDown={onKeyDown}
      >
        <div
          className="nb-carousel__slide"
          role="group"
          aria-roledescription="slide"
          aria-label={slideLabel}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (startX.current = null)}
        >
          {slide.image && <SafeImage media={slide.image} className="nb-carousel__image" />}
          {slide.title && <h3 className="nb-carousel__title">{slide.title}</h3>}
          {slide.text && <RichText text={slide.text} paragraphs />}
        </div>
        <div className="nb-carousel__nav">
          <button
            type="button"
            className="nb-btn nb-btn--secondary nb-carousel__arrow"
            onClick={() => canPrev && go(index - 1, "button")}
            // aria-disabled, not disabled: the focused button keeps focus at the first/last slide.
            aria-disabled={!canPrev || undefined}
          >
            <ChevronLeft aria-hidden size={18} />
            <span className="nb-sr-only">{t("carousel.previous")}</span>
          </button>
          {showDots && total > 1 && (
            <div className="nb-carousel__dots" role="group" aria-label={t("carousel.dots")}>
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className="nb-carousel__dot"
                  aria-current={i === index ? "true" : undefined}
                  onClick={() => go(i, "dot")}
                >
                  <span className="nb-sr-only">{t("carousel.goTo", { n: i + 1 })}</span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="nb-btn nb-btn--secondary nb-carousel__arrow"
            onClick={() => canNext && go(index + 1, "button")}
            // aria-disabled, not disabled: the focused button keeps focus at the first/last slide.
            aria-disabled={!canNext || undefined}
          >
            <ChevronRight aria-hidden size={18} />
            <span className="nb-sr-only">{t("carousel.next")}</span>
          </button>
        </div>
      </div>
    </ModuleShell>
  );
}
