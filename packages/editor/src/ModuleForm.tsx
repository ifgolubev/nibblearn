import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { getModuleJsonSchema, type JsonSchema, type ValidationIssue } from "@nibblearn/react";
import { LiveRegion, defaultRegistry, useAnnounce, type ModuleRegistry } from "@nibblearn/react";
import { useEditorT } from "./messages";
import {
  FormContext,
  fieldId,
  issueMap,
  matchesPath,
  pathKey,
  type FormContextValue,
  type PickedImage,
} from "./form/context";
import { Field } from "./form/fields";
import { setAt, type Path } from "./form/path";
import { toFormNode } from "./form/schema";

export interface ModuleFormProps {
  /** Module config in its input (authoring) form. */
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** Validation issues to show next to their fields (e.g. from `validateModule`). */
  issues?: ValidationIssue[];
  /** Registry used to find the module's schema. Defaults to the built-in modules. */
  registry?: ModuleRegistry;
  /** Called with the path of the list item that receives focus (for preview `focus`). */
  onFocusPath?: (path: (string | number)[]) => void;
  /** Opens the host's file picker; enables the "Choose image" button. */
  onPickImage?: () => Promise<PickedImage | null>;
  /** Use this JSON Schema instead of the module type's (e.g. lesson settings). */
  schema?: JsonSchema;
  /**
   * Fields to leave out of the form, as dot paths: `"appearance"`, `"behavior.completeOn"`,
   * `"content.items.*.image"` (`*` is any one key or list index). Hiding an object or a list
   * hides everything inside it. Values already in `value` are kept as they are.
   */
  hideFields?: readonly string[];
  /**
   * Leave out every `id` field (the block's own and those of list items). New items still get
   * generated ids. Use it when your application assigns ids itself.
   */
  hideIds?: boolean;
  className?: string;
}

/**
 * A form for any registered module, generated from its JSON Schema (field titles, hints and
 * widgets come from the schema's `x-ui` metadata). Fully controlled.
 */
export function ModuleForm({
  value,
  onChange,
  issues,
  registry = defaultRegistry,
  onFocusPath,
  onPickImage,
  schema: schemaOverride,
  hideFields,
  hideIds = false,
  className,
}: ModuleFormProps) {
  const t = useEditorT();
  const type = String(value.type ?? "");
  const schema = useMemo(
    () => schemaOverride ?? getModuleJsonSchema(type, { registry: registry.schemas }),
    [schemaOverride, type, registry],
  );
  const root = useMemo(() => (schema ? toFormNode(schema) : null), [schema]);
  const formId = `nbe${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { message, announce } = useAnnounce();
  const issueIndex = useMemo(() => issueMap(issues), [issues]);
  // By content, so an inline array literal does not rebuild the form context on every render.
  const hiddenKey = (hideFields ?? []).join("\n");
  const isHidden = useCallback(
    (path: Path, widget: string | undefined) =>
      (hideIds && widget === "id") ||
      (hiddenKey !== "" && matchesPath(path, hiddenKey.split("\n"))),
    [hiddenKey, hideIds],
  );

  // Updates apply to the latest value, not the one captured by a handler: an async image
  // picker (or two updates before the host re-renders) must not undo other edits.
  // `committed` is the host's value after each commit. Updates sent in the same task chain on
  // `pending`, which is dropped afterwards, so a change the host rejected is never re-sent.
  const committed = useRef(value);
  const pending = useRef<{ value: unknown } | null>(null);
  useEffect(() => {
    committed.current = value;
  });
  const update = useCallback(
    (path: Path, next: unknown) => {
      const base = pending.current ? pending.current.value : committed.current;
      const updated = setAt(base, path, next);
      if (!pending.current) queueMicrotask(() => (pending.current = null));
      pending.current = { value: updated };
      onChange(updated as typeof value);
    },
    [onChange],
  );

  const ctx = useMemo<FormContextValue>(
    () => ({
      formId,
      type,
      root: value,
      update,
      issuesAt: (path) => issueIndex.get(pathKey(path)) ?? [],
      onFocusPath,
      onPickImage,
      announce,
      isHidden,
    }),
    [formId, type, value, update, issueIndex, onFocusPath, onPickImage, announce, isHidden],
  );

  if (!root) return null;
  const focusField = (issue: ValidationIssue) => {
    const segments = issue.segments ?? [];
    for (let n = segments.length; n >= 0; n--) {
      const el = document.getElementById(fieldId(formId, segments.slice(0, n)));
      if (el) {
        el.focus();
        el.scrollIntoView?.({ block: "center" });
        return;
      }
    }
  };

  return (
    <FormContext.Provider value={ctx}>
      <div className={["nbe-form", className].filter(Boolean).join(" ")}>
        {issues && issues.length > 0 && (
          <div className="nbe-issues" role="group" aria-labelledby={`${formId}-issues`}>
            <p className="nbe-issues__title" id={`${formId}-issues`}>
              <AlertCircle aria-hidden size={16} />
              {t("editor.issues.title", { count: issues.length })}
            </p>
            <ul className="nbe-issues__list">
              {issues.slice(0, 12).map((issue, i) => (
                <li key={i}>
                  <button type="button" className="nbe-link" onClick={() => focusField(issue)}>
                    <code>{issue.path}</code>: {issue.message}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Field
          field={{ key: type, node: root, required: true }}
          path={[]}
          value={value}
          depth={0}
        />
        <LiveRegion message={message} />
      </div>
    </FormContext.Provider>
  );
}
