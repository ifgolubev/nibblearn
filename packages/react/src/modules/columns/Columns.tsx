import { useMemo } from "react";
import { columnsSchema, type ColumnsConfig } from "@nibblearn/core";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { InvalidModule, ModuleShell } from "../../primitives/ModuleShell";
import { RichText } from "../../primitives/RichText";
import { SafeImage } from "../../primitives/SafeImage";
import { runKey } from "../runKey";
import type { ModuleProps } from "../types";
import { useBlockCompletion } from "../useBlockCompletion";
import "./columns.css";

export type ColumnsProps = ModuleProps<ColumnsConfig>;

/** Two to four columns side by side; they stack on narrow containers. */
export function Columns({ config: rawConfig, ...rest }: ColumnsProps) {
  const parsed = useMemo(() => columnsSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success)
    return (
      <InvalidModule
        type="columns"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  return <ColumnsInner config={parsed.data} {...rest} />;
}

function ColumnsInner(props: ColumnsProps) {
  const { config, onComplete, onEvent, resetKey, initialState, onStateChange, mode, focus } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "columns",
    onComplete,
    onEvent,
    resetKey,
    config,
    initialState,
    onStateChange,
    mode,
    focus,
  });
  return <ColumnsRun key={runKey(life, config)} {...props} life={life} />;
}

function ColumnsRun({
  config,
  life,
  hideHeader,
  className,
}: ColumnsProps & { life: ModuleLifecycle }) {
  const { columns } = config.content;
  useBlockCompletion(life, "view", 1, 1);
  return (
    <ModuleShell
      type="columns"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : config.instructions}
      appearance={config.appearance}
      className={className}
      width={columns.length > 2 ? "wide" : "default"}
    >
      <div className="nb-columns" data-count={columns.length} data-ratio={config.layout.ratio}>
        {columns.map((col) => (
          <section key={col.id} className="nb-columns__col" aria-label={col.title ?? undefined}>
            {col.image && <SafeImage media={col.image} className="nb-columns__image" />}
            {col.title && <h3 className="nb-columns__title">{col.title}</h3>}
            {col.text && <RichText text={col.text} paragraphs />}
          </section>
        ))}
      </div>
    </ModuleShell>
  );
}
