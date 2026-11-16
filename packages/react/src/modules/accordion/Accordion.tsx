import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { accordionSchema, type AccordionConfig } from "@nibblearn/core";
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
import "./accordion.css";

export type AccordionProps = ModuleProps<AccordionConfig>;

/** Collapsible panels for details the learner can open when needed. */
export function Accordion({ config: rawConfig, ...rest }: AccordionProps) {
  const parsed = useMemo(() => accordionSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success)
    return (
      <InvalidModule
        type="accordion"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  return <AccordionInner config={parsed.data} {...rest} />;
}

function AccordionInner(props: AccordionProps) {
  const { config, onComplete, onEvent, resetKey, initialState, onStateChange, mode, focus } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "accordion",
    onComplete,
    onEvent,
    resetKey,
    config,
    initialState,
    onStateChange,
    mode,
    focus,
  });
  return <AccordionRun key={runKey(life, config)} {...props} life={life} />;
}

function AccordionRun({
  config,
  life,
  hideHeader,
  className,
}: AccordionProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const { items } = config.content;
  const { allowMultiple, defaultOpen, completeOn } = config.behavior;
  const ids = items.map((i) => i.id);
  const initial =
    defaultOpen === "all"
      ? allowMultiple
        ? ids
        : ids.slice(0, 1)
      : defaultOpen === "first"
        ? ids.slice(0, 1)
        : [];

  // Progress is saved in the state snapshot (initialState / onStateChange).
  const idList = G.arrayOf(G.oneOf(ids), ids.length);
  const [open, setOpen] = usePersistedState<string[]>(life, "open", initial, idList);
  const [seen, setSeen] = usePersistedState<string[]>(life, "seen", initial, idList);
  useFocusSync(life, ["content", "items"], items.length, (i) => {
    const id = ids[i]!;
    setOpen((prev) => (allowMultiple ? (prev.includes(id) ? prev : [...prev, id]) : [id]));
  });
  useBlockCompletion(life, completeOn, seen.length, items.length);

  const toggle = (id: string) => {
    const opening = !open.includes(id);
    setOpen((prev) =>
      opening ? (allowMultiple ? [...prev, id] : [id]) : prev.filter((x) => x !== id),
    );
    if (opening) {
      setSeen((prev) => (prev.includes(id) ? prev : [...prev, id]));
      life.emit("module:interact", { action: "open", itemId: id });
    } else life.emit("module:interact", { action: "close", itemId: id });
  };

  return (
    <ModuleShell
      type="accordion"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : config.instructions}
      appearance={config.appearance}
      className={className}
      aside={
        completeOn === "all-items" ? (
          <span className="nb-counter">
            {t("accordion.progress", { opened: seen.length, total: items.length })}
          </span>
        ) : undefined
      }
    >
      <div className="nb-acc">
        {items.map((item) => {
          const isOpen = open.includes(item.id);
          const headId = `${config.id}-${item.id}-head`;
          const panelId = `${config.id}-${item.id}-panel`;
          return (
            <div key={item.id} className="nb-acc__item" data-open={isOpen || undefined}>
              <h3 className="nb-acc__heading">
                <button
                  type="button"
                  id={headId}
                  className="nb-acc__trigger"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(item.id)}
                >
                  <span className="nb-acc__title">{item.title}</span>
                  <ChevronDown className="nb-acc__chevron" aria-hidden size={18} />
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={headId}
                className="nb-acc__panel"
                hidden={!isOpen}
              >
                <RichText text={item.text} paragraphs />
                {item.image && <SafeImage media={item.image} className="nb-acc__image" />}
              </div>
            </div>
          );
        })}
      </div>
    </ModuleShell>
  );
}
