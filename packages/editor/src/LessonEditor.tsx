import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Copy, Plus, Settings, Trash2 } from "lucide-react";
import {
  getLessonJsonSchema,
  stripMarkup,
  validateLesson,
  validateModule,
  type ValidationIssue,
} from "@nibblearn/react";
import { ModuleIcon, defaultRegistry, useRootProps, type ModuleRegistry } from "@nibblearn/react";
import { BlockPicker } from "./BlockPicker";
import { uniqueId } from "./form/defaults";
import { useEditorT } from "./messages";
import { ModuleEditor } from "./ModuleEditor";
import { ModuleForm, type ModuleFormProps } from "./ModuleForm";

export interface LessonEditorProps {
  /** Lesson JSON (input form). */
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  registry?: ModuleRegistry;
  onPickImage?: ModuleFormProps["onPickImage"];
}

type Module = Record<string, unknown> & { id?: unknown; type?: unknown; title?: unknown };

/** Edit a whole lesson: the list of blocks, each block's settings with preview, and lesson settings. */
export function LessonEditor({
  value,
  onChange,
  registry = defaultRegistry,
  onPickImage,
}: LessonEditorProps) {
  const t = useEditorT();
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const modules = (Array.isArray(value.modules) ? value.modules : []) as Module[];
  const [selected, setSelected] = useState<number | "settings" | "add">(modules.length ? 0 : "add");
  // The block that is shown and edited: the selection clamped to the current list.
  const index =
    typeof selected === "number" && modules.length ? Math.min(selected, modules.length - 1) : -1;
  const current = index >= 0 ? modules[index] : undefined;

  const settingsSchema = useMemo(() => {
    const s = getLessonJsonSchema({ registry: registry.schemas }) as Record<string, unknown> & {
      properties: Record<string, unknown>;
      required?: string[];
    };
    const { modules: _modules, schemaVersion: _version, ...properties } = s.properties;
    return {
      ...s,
      properties,
      required: (s.required ?? []).filter((k) => k !== "modules" && k !== "schemaVersion"),
    };
  }, [registry]);

  // Remount the block editor when the selection or the block list changes, or when the host
  // replaces the value (undo, another lesson), never on an id edit.
  const [generation, setGeneration] = useState(0);
  const [own, setOwn] = useState<unknown>(null);
  const [seen, setSeen] = useState<unknown>(value);
  if (seen !== value) {
    setSeen(value);
    if (value !== own) setGeneration((g) => g + 1);
  }
  // Changes apply to the host's latest value, so a late update (an async image picker) keeps
  // edits made meanwhile; one made for an older block list is dropped.
  const latest = useRef({ value, generation });
  useEffect(() => {
    latest.current = { value, generation };
  });
  const emit = (next: Record<string, unknown>) => {
    setOwn(next);
    onChange(next);
  };
  const setModules = (next: Module[], structural = false) => {
    if (structural) setGeneration((g) => g + 1);
    emit({ ...latest.current.value, modules: next });
  };
  const ids = modules.map((m) => String(m.id ?? ""));

  // Lesson-level validation: settings problems go to the settings form; problems of a block
  // that only the lesson can see (a duplicate id…) are marked in the list and shown above it.
  const lessonIssues = useMemo<ValidationIssue[]>(() => {
    const r = validateLesson(value, { registry: registry.schemas });
    return r.success ? [] : r.issues;
  }, [value, registry]);
  const blockOf = (i: ValidationIssue) =>
    i.segments?.[0] === "modules" && typeof i.segments[1] === "number" ? i.segments[1] : -1;
  const settingsIssues = lessonIssues.filter((i) => blockOf(i) < 0);
  const hasIssues = (b: number) => lessonIssues.some((i) => blockOf(i) === b);
  const ownIssues = current ? validateModule(current, { registry: registry.schemas }) : null;
  const known = new Set(
    ownIssues && !ownIssues.success ? ownIssues.issues.map((i) => i.message) : [],
  );
  const currentExtra = current
    ? lessonIssues.filter((i) => blockOf(i) === index && !known.has(i.message))
    : [];
  const nameOf = (m: Module) =>
    (typeof m.title === "string" && m.title ? stripMarkup(m.title) : undefined) ??
    registry.get(String(m.type))?.name ??
    String(m.type);

  const move = (i: number, to: number) => {
    if (to < 0 || to >= modules.length) return;
    const next = [...modules];
    const [m] = next.splice(i, 1);
    next.splice(to, 0, m!);
    setModules(next, true);
    setSelected(to);
  };
  const duplicate = (i: number) => {
    const copy = structuredClone(modules[i]!);
    copy.id = uniqueId(String(copy.id ?? copy.type ?? "block").replace(/-\d+$/, ""), ids);
    const next = [...modules];
    next.splice(i + 1, 0, copy);
    setModules(next, true);
    setSelected(i + 1);
  };
  const remove = (i: number) => {
    setModules(
      modules.filter((_, j) => j !== i),
      true,
    );
    setSelected(modules.length > 1 ? Math.max(0, i - 1) : "add");
  };

  // Theme attribute and provider tokens (accent, radius, font), like module roots.
  const rootProps = useRootProps();
  return (
    // The root is the size container; the layout grid is its child so the query can match.
    <div className="nbe-root nb-theme" {...rootProps}>
      <div className="nbe-lesson">
        <nav className="nbe-lesson__nav" aria-labelledby={`${id}-blocks`}>
          <h2 className="nbe-lesson__heading" id={`${id}-blocks`}>
            {t("editor.lesson.modules")}
          </h2>
          {modules.length === 0 && <p className="nbe-note">{t("editor.lesson.empty")}</p>}
          <ol className="nbe-lesson__list">
            {modules.map((m, i) => (
              <li
                key={`${String(m.id)}-${i}`}
                className="nbe-lesson__item"
                data-selected={selected === i || undefined}
              >
                <button
                  type="button"
                  className="nbe-lesson__select"
                  aria-current={selected === i ? "true" : undefined}
                  onClick={() => setSelected(i)}
                >
                  <ModuleIcon type={String(m.type)} registry={registry} size={16} />
                  <span className="nbe-lesson__name">{nameOf(m)}</span>
                  {hasIssues(i) && (
                    <>
                      <AlertCircle aria-hidden size={14} className="nbe-lesson__issue" />
                      <span className="nbe-sr-only">, {t("editor.lesson.hasIssues")}</span>
                    </>
                  )}
                  <span className="nbe-sr-only">
                    {t("editor.lesson.position", { current: i + 1, total: modules.length })}
                  </span>
                </button>
                <span className="nbe-lesson__actions">
                  <button
                    type="button"
                    className="nbe-icon-btn"
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                  >
                    <ArrowUp aria-hidden size={14} />
                    <span className="nbe-sr-only">
                      {t("editor.moveUpItem", { item: nameOf(m), index: "" })}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="nbe-icon-btn"
                    disabled={i === modules.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    <ArrowDown aria-hidden size={14} />
                    <span className="nbe-sr-only">
                      {t("editor.moveDownItem", { item: nameOf(m), index: "" })}
                    </span>
                  </button>
                  <button type="button" className="nbe-icon-btn" onClick={() => duplicate(i)}>
                    <Copy aria-hidden size={14} />
                    <span className="nbe-sr-only">
                      {t("editor.duplicateItem", { item: nameOf(m), index: "" })}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="nbe-icon-btn nbe-icon-btn--danger"
                    disabled={modules.length <= 1}
                    onClick={() => remove(i)}
                  >
                    <Trash2 aria-hidden size={14} />
                    <span className="nbe-sr-only">
                      {t("editor.removeItem", { item: nameOf(m), index: "" })}
                    </span>
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <div className="nbe-lesson__nav-actions">
            <button
              type="button"
              className="nbe-btn nbe-btn--dashed"
              aria-pressed={selected === "add"}
              onClick={() => setSelected("add")}
            >
              <Plus aria-hidden size={14} />
              {t("editor.lesson.addBlock")}
            </button>
            <button
              type="button"
              className="nbe-btn"
              aria-pressed={selected === "settings"}
              onClick={() => setSelected("settings")}
            >
              <Settings aria-hidden size={14} />
              {t("editor.lesson.settings")}
            </button>
          </div>
        </nav>
        <div className="nbe-lesson__main">
          {selected === "settings" && (
            <section aria-labelledby={`${id}-settings`}>
              <h2 className="nbe-lesson__heading" id={`${id}-settings`}>
                {t("editor.lesson.settings")}
              </h2>
              <ModuleForm
                value={value}
                onChange={(next) =>
                  emit({
                    ...next,
                    modules: latest.current.value.modules,
                    schemaVersion: latest.current.value.schemaVersion ?? 1,
                  })
                }
                schema={settingsSchema}
                registry={registry}
                onPickImage={onPickImage}
                issues={settingsIssues}
              />
            </section>
          )}
          {selected === "add" && (
            <BlockPicker
              registry={registry}
              existingIds={ids}
              onPick={(config) => {
                setModules([...modules, config], true);
                setSelected(modules.length);
              }}
            />
          )}
          {current && typeof selected === "number" && currentExtra.length > 0 && (
            <div className="nbe-issues" role="group" aria-label={t("editor.lesson.blockIssues")}>
              <ul className="nbe-issues__list">
                {currentExtra.map((issue, k) => (
                  <li key={k}>
                    <code>{issue.path}</code>: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {current && typeof selected === "number" && (
            <ModuleEditor
              key={`${generation}:${index}`}
              value={current}
              registry={registry}
              onPickImage={onPickImage}
              onChange={(next) => {
                // Dropped when the block list changed after this editor was rendered.
                const at = latest.current;
                if (at.generation !== generation) return;
                const list = (Array.isArray(at.value.modules) ? at.value.modules : []) as Module[];
                setModules(list.map((m, j) => (j === index ? next : m)));
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
