import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import clsx from "clsx";
import { hotspotExplorerSchema, type Hotspot, type HotspotExplorerConfig } from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Button } from "../../primitives/Button";
import { ProgressBar } from "../../primitives/ProgressBar";
import { RichText } from "../../primitives/RichText";
import { SafeImage } from "../../primitives/SafeImage";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./hotspot-explorer.css";

export type HotspotExplorerProps = ModuleProps<HotspotExplorerConfig>;

/** Container width (px) from which the info panel floats next to the marker. */
const FLOAT_BREAKPOINT = 720;

export function HotspotExplorer({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: HotspotExplorerProps) {
  const parsed = useMemo(() => hotspotExplorerSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="hotspot-explorer"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <HotspotLifecycle
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

function HotspotLifecycle({
  config,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: HotspotExplorerProps) {
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "hotspot-explorer",
    onComplete,
    onEvent,
    resetKey,
  });
  return (
    <HotspotBody
      key={life.runId}
      config={config}
      life={life}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

interface BodyProps {
  config: HotspotExplorerConfig;
  life: ModuleLifecycle;
  hideHeader?: boolean;
  className?: string;
}

/** Floating-card position derived from the marker position (percentages of the stage). */
function floatingStyle(h: Hotspot): CSSProperties {
  const gap = 2.5; // % of stage
  const cx = h.shape === "rect" ? h.x + (h.width ?? 0) / 2 : h.x;
  const cy = h.shape === "rect" ? h.y + (h.height ?? 0) / 2 : h.y;
  const right = h.shape === "rect" ? h.x + (h.width ?? 0) : h.x;
  const bottom = h.shape === "rect" ? h.y + (h.height ?? 0) : h.y;
  const placement = h.placement === "auto" ? (cx > 50 ? "left" : "right") : h.placement;
  const style: CSSProperties = {};
  switch (placement) {
    case "left":
      style.right = `${100 - h.x + gap}%`;
      if (cy > 50) style.bottom = `${100 - bottom}%`;
      else style.top = `${h.y}%`;
      break;
    case "right":
      style.left = `${right + gap}%`;
      if (cy > 50) style.bottom = `${100 - bottom}%`;
      else style.top = `${h.y}%`;
      break;
    case "top":
      style.bottom = `${100 - h.y + gap}%`;
      if (cx > 50) style.right = `${100 - right}%`;
      else style.left = `${h.x}%`;
      break;
    case "bottom":
      style.top = `${bottom + gap}%`;
      if (cx > 50) style.right = `${100 - right}%`;
      else style.left = `${h.x}%`;
      break;
  }
  return style;
}

function HotspotBody({ config, life, hideHeader, className }: BodyProps) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { hotspots, image } = config.content;
  const { behavior } = config;
  const total = hotspots.length;

  const [visited, setVisited] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
  const [wide, setWide] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef(new Map<string, HTMLButtonElement>());
  const returnFocusTo = useRef<string | null>(null);

  // Track the stage width to decide between a floating card and an in-flow panel.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setWide(el.clientWidth >= FLOAT_BREAKPOINT);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, []);

  const activeIndex = activeId ? hotspots.findIndex((h) => h.id === activeId) : -1;
  const active = activeIndex >= 0 ? hotspots[activeIndex]! : null;
  const allVisited = visited.length >= total;

  const complete = useCallback(
    (ids: string[]) => {
      setFinished(true);
      life.complete({ details: { visited: ids } });
      announce(t("a11y.moduleComplete"));
    },
    [life, announce, t],
  );

  const open = useCallback(
    (id: string, fromMarker = true) => {
      const h = hotspots.find((x) => x.id === id);
      if (!h) return;
      if (fromMarker) returnFocusTo.current = id;
      setActiveId(id);
      life.emit("module:interact", { hotspotId: id });
      announce(h.title ?? h.label);
      if (!visited.includes(id)) {
        const next = [...visited, id];
        setVisited(next);
        if (behavior.requireAll && next.length >= total) complete(next);
      }
      requestAnimationFrame(() => panelRef.current?.focus());
    },
    [hotspots, life, announce, visited, behavior.requireAll, total, complete],
  );

  const close = useCallback(() => {
    setActiveId(null);
    const id = returnFocusTo.current;
    requestAnimationFrame(() => {
      if (id) markerRefs.current.get(id)?.focus();
    });
  }, []);

  const step = useCallback(
    (delta: number) => {
      if (activeIndex < 0) return;
      const next = hotspots[(activeIndex + delta + total) % total]!;
      open(next.id);
    },
    [activeIndex, hotspots, total, open],
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      if (e.key === "Escape" && activeId) {
        e.preventDefault();
        close();
      }
    },
    [activeId, close],
  );

  const ratio =
    image.width && image.height
      ? `${image.width} / ${image.height}`
      : naturalRatio
        ? `${naturalRatio}`
        : undefined;
  const stageStyle: CSSProperties | undefined = ratio ? { aspectRatio: ratio } : undefined;

  const panel = active && (
    <motion.div
      key={active.id}
      ref={panelRef}
      className={clsx("nb-hotspot__panel", wide && "nb-hotspot__panel--floating")}
      style={wide ? floatingStyle(active) : undefined}
      role="group"
      aria-labelledby={`${config.id}-hs-${active.id}`}
      tabIndex={-1}
      initial={reduced ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: reduced ? 0 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="nb-hotspot__panel-head">
        <span className="nb-hotspot__panel-index" aria-hidden>
          {activeIndex + 1}
        </span>
        <h3 className="nb-hotspot__panel-title" id={`${config.id}-hs-${active.id}`}>
          {active.title ?? active.label}
        </h3>
        <Button
          icon
          size="sm"
          variant="ghost"
          aria-label={t("common.close")}
          onClick={close}
          className="nb-hotspot__close"
        >
          <X aria-hidden />
        </Button>
      </div>
      <div className="nb-hotspot__panel-body">
        <RichText text={active.description} paragraphs />
      </div>
      {total > 1 && (
        <div className="nb-hotspot__panel-nav">
          <Button
            size="sm"
            variant="ghost"
            leading={<ArrowLeft aria-hidden />}
            onClick={() => step(-1)}
          >
            {t("common.previous")}
          </Button>
          <span className="nb-counter">
            {t("common.item", { current: activeIndex + 1, total })}
          </span>
          <Button
            size="sm"
            variant="ghost"
            trailing={<ArrowRight aria-hidden />}
            onClick={() => step(1)}
          >
            {t("common.next")}
          </Button>
        </div>
      )}
    </motion.div>
  );

  return (
    <ModuleShell
      type="hotspot-explorer"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : (config.instructions ?? t("hotspot.instructions"))}
      appearance={config.appearance}
      className={className}
      announcement={message}
      width="wide"
      aside={
        <span className="nb-counter">
          {t("hotspot.explored", { count: visited.length, total })}
        </span>
      }
      eyebrow={
        <ProgressBar
          value={visited.length / total}
          showLabel={false}
          size="sm"
          tone={allVisited ? "success" : "accent"}
        />
      }
      onKeyDown={onKeyDown}
    >
      <div
        ref={stageRef}
        className="nb-hotspot__stage"
        style={stageStyle}
        data-ratio={ratio ? "true" : undefined}
        data-pulse={behavior.pulse ? "true" : undefined}
      >
        <SafeImage
          media={image}
          className="nb-hotspot__image"
          showCaption={false}
          onLoaded={({ width, height }) => {
            if (width && height && !(image.width && image.height)) setNaturalRatio(width / height);
          }}
        />
        {hotspots.map((h, i) => {
          const isVisited = visited.includes(h.id);
          const isActive = activeId === h.id;
          const style: CSSProperties =
            h.shape === "rect"
              ? {
                  left: `${h.x}%`,
                  top: `${h.y}%`,
                  width: `${h.width ?? 10}%`,
                  height: `${h.height ?? 10}%`,
                }
              : { left: `${h.x}%`, top: `${h.y}%` };
          return (
            <button
              key={h.id}
              ref={(el) => {
                if (el) markerRefs.current.set(h.id, el);
                else markerRefs.current.delete(h.id);
              }}
              type="button"
              className="nb-hotspot__marker"
              data-shape={h.shape}
              data-visited={isVisited ? "true" : "false"}
              data-active={isActive ? "true" : "false"}
              style={style}
              aria-label={t("hotspot.marker", { index: i + 1, label: h.label })}
              aria-expanded={isActive}
              aria-controls={isActive ? `${config.id}-hs-${h.id}` : undefined}
              onClick={() => (isActive ? close() : open(h.id))}
            >
              <span className="nb-hotspot__dot" aria-hidden>
                {isVisited && !isActive ? (
                  <Check strokeWidth={3} />
                ) : behavior.numbered ? (
                  i + 1
                ) : null}
              </span>
            </button>
          );
        })}
        {wide && (
          <AnimatePresence initial={false} mode="wait">
            {panel}
          </AnimatePresence>
        )}
      </div>
      {image.caption && <p className="nb-hotspot__caption nb-muted nb-text-sm">{image.caption}</p>}

      {!wide && (
        <AnimatePresence initial={false} mode="wait">
          {panel}
        </AnimatePresence>
      )}

      <section className="nb-hotspot__list" aria-label={t("hotspot.list")}>
        <h3 className="nb-hotspot__list-title">{t("hotspot.list")}</h3>
        <ol className="nb-hotspot__items">
          {hotspots.map((h, i) => {
            const isVisited = visited.includes(h.id);
            return (
              <li key={h.id}>
                <button
                  type="button"
                  className="nb-hotspot__item"
                  data-visited={isVisited ? "true" : "false"}
                  aria-current={activeId === h.id ? "true" : undefined}
                  onClick={() => open(h.id, false)}
                >
                  <span className="nb-hotspot__item-index" aria-hidden>
                    {isVisited ? <Check strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="nb-hotspot__item-label">{h.label}</span>
                  {isVisited && (
                    <span className="nb-hotspot__item-status">{t("hotspot.visited")}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {!finished && !behavior.requireAll && visited.length > 0 && (
        <div className="nb-module__actions">
          <Button variant="primary" onClick={() => complete(visited)}>
            {t("common.finish")}
          </Button>
        </div>
      )}

      {finished && (
        <CompletionCard
          title={t("hotspot.allExplored")}
          text={config.feedback.complete ?? undefined}
          stats={[{ label: t("hotspot.visited"), value: `${visited.length}/${total}` }]}
          retryLabel={t("common.restart")}
          onRetry={() => {
            life.reset();
            life.emit("module:reset");
          }}
        />
      )}
    </ModuleShell>
  );
}

export default HotspotExplorer;
