import { useMemo } from "react";
import {
  CircleCheck,
  Info,
  Lightbulb,
  StickyNote,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { calloutSchema, type CalloutConfig } from "@nibblearn/core";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { InvalidModule, ModuleShell } from "../../primitives/ModuleShell";
import { RichText } from "../../primitives/RichText";
import { runKey } from "../runKey";
import type { ModuleProps } from "../types";
import { useBlockCompletion } from "../useBlockCompletion";
import "./callout.css";

export type CalloutProps = ModuleProps<CalloutConfig>;

const ICONS: Record<CalloutConfig["content"]["variant"], LucideIcon> = {
  info: Info,
  tip: Lightbulb,
  warning: TriangleAlert,
  success: CircleCheck,
  note: StickyNote,
};

/** A highlighted note, tip or warning inside lesson text. */
export function Callout({ config: rawConfig, ...rest }: CalloutProps) {
  const parsed = useMemo(() => calloutSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success)
    return (
      <InvalidModule
        type="callout"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  return <CalloutInner config={parsed.data} {...rest} />;
}

function CalloutInner(props: CalloutProps) {
  const { config, onComplete, onEvent, resetKey, initialState, onStateChange, mode, focus } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "callout",
    onComplete,
    onEvent,
    resetKey,
    config,
    initialState,
    onStateChange,
    mode,
    focus,
  });
  return <CalloutRun key={runKey(life, config)} {...props} life={life} />;
}

function CalloutRun({ config, life, className }: CalloutProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const { variant, title, text } = config.content;
  const Icon = ICONS[variant];
  useBlockCompletion(life, "view", 1, 1);
  return (
    <ModuleShell type="callout" id={config.id} appearance={config.appearance} className={className}>
      <div
        className="nb-callout"
        data-variant={variant}
        data-accented={config.appearance.accent ? "" : undefined}
        role="note"
        aria-label={title ?? t(`callout.${variant}`)}
      >
        <Icon className="nb-callout__icon" aria-hidden size={20} />
        <div className="nb-callout__body">
          <span className="nb-sr-only">{t(`callout.${variant}`)}: </span>
          {title && <h3 className="nb-callout__title">{title}</h3>}
          <RichText text={text} paragraphs />
        </div>
      </div>
    </ModuleShell>
  );
}
