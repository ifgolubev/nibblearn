import { useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { tabsSchema, type TabsConfig } from "@nibblearn/core";
import { useNibblearn } from "../../context/NibblearnProvider";
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
import "./tabs.css";

export type TabsProps = ModuleProps<TabsConfig>;

/** Parallel views of one topic, one tab at a time (WAI-ARIA tabs pattern). */
export function Tabs({ config: rawConfig, ...rest }: TabsProps) {
  const parsed = useMemo(() => tabsSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success)
    return (
      <InvalidModule
        type="tabs"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  return <TabsInner config={parsed.data} {...rest} />;
}

function TabsInner(props: TabsProps) {
  const { config, onComplete, onEvent, resetKey, initialState, onStateChange, mode, focus } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "tabs",
    onComplete,
    onEvent,
    resetKey,
    config,
    initialState,
    onStateChange,
    mode,
    focus,
  });
  return <TabsRun key={runKey(life, config)} {...props} life={life} />;
}

function TabsRun({ config, life, hideHeader, className }: TabsProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const { tabs } = config.content;
  const { completeOn } = config.behavior;
  const ids = tabs.map((tab) => tab.id);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Progress is saved in the state snapshot (initialState / onStateChange).
  const [active, setActive] = usePersistedState(life, "active", 0, G.int(0, tabs.length - 1));
  const [seen, setSeen] = usePersistedState<string[]>(
    life,
    "seen",
    () => [ids[0]!],
    G.arrayOf(G.oneOf(ids), ids.length),
  );
  useFocusSync(life, ["content", "tabs"], tabs.length, (i) => setActive(i));
  useBlockCompletion(life, completeOn, seen.length, tabs.length);

  const select = (i: number, moveFocus = false) => {
    setActive(i);
    const id = ids[i]!;
    setSeen((prev) => (prev.includes(id) ? prev : [...prev, id]));
    life.emit("module:interact", { action: "select", itemId: id, itemIndex: i });
    if (moveFocus) tabRefs.current[i]?.focus();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight"
        ? active === last
          ? 0
          : active + 1
        : e.key === "ArrowLeft"
          ? active === 0
            ? last
            : active - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    select(next, true);
  };

  const tab = tabs[active]!;
  const tabId = (i: number) => `${config.id}-tab-${i}`;
  const panelId = `${config.id}-panel`;
  return (
    <ModuleShell
      type="tabs"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : config.instructions}
      appearance={config.appearance}
      className={className}
      aside={
        completeOn === "all-items" ? (
          <span className="nb-counter">
            {t("tabs.progress", { seen: seen.length, total: tabs.length })}
          </span>
        ) : undefined
      }
    >
      <div className="nb-tabs">
        <div
          className="nb-tabs__list"
          role="tablist"
          aria-label={config.title ?? undefined}
          onKeyDown={onKeyDown}
        >
          {tabs.map((item, i) => (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={tabId(i)}
              className="nb-tabs__tab"
              aria-selected={i === active}
              aria-controls={panelId}
              tabIndex={i === active ? 0 : -1}
              onClick={() => select(i)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          className="nb-tabs__panel"
          role="tabpanel"
          id={panelId}
          aria-labelledby={tabId(active)}
          tabIndex={0}
        >
          <RichText text={tab.text} paragraphs />
          {tab.image && <SafeImage media={tab.image} className="nb-tabs__image" />}
        </div>
      </div>
    </ModuleShell>
  );
}
