import { useEffect, useMemo, useState } from "react";
import { validateModule, type ModuleConfig, type ValidationIssue } from "@nibblearn/react";
import { ModuleRenderer, defaultRegistry, useRootProps } from "@nibblearn/react";
import { useEditorT } from "./messages";
import { ModuleForm, type ModuleFormProps } from "./ModuleForm";

export interface ModuleEditorProps extends Omit<ModuleFormProps, "issues" | "onFocusPath"> {
  /** "split" (default): form and preview side by side, stacked on narrow containers. */
  layout?: "split" | "stacked" | "form";
  /** Called whenever validity changes. */
  onValidityChange?: (state: { valid: boolean; issues: ValidationIssue[] }) => void;
}

/** A module form with a live preview that follows the item being edited. */
export function ModuleEditor({ layout = "split", onValidityChange, ...form }: ModuleEditorProps) {
  const t = useEditorT();
  const registry = form.registry ?? defaultRegistry;
  const result = useMemo(
    () => validateModule(form.value, { registry: registry.schemas }),
    [form.value, registry],
  );
  const issues = result.success ? [] : result.issues;
  const [lastValid, setLastValid] = useState<ModuleConfig | null>(() =>
    result.success ? result.data : null,
  );
  if (result.success && result.data !== lastValid) setLastValid(result.data);
  const [focusPath, setFocusPath] = useState<(string | number)[] | null>(null);

  useEffect(() => {
    onValidityChange?.({ valid: result.success, issues });
    // Only when validity or the issue list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.success, JSON.stringify(issues)]);

  const preview = lastValid ?? null;
  // Theme attribute and provider tokens (accent, radius, font), like module roots.
  const rootProps = useRootProps();
  return (
    // The root is the size container; the layout grid is its child so the query can match.
    <div className="nbe-root nb-theme" {...rootProps}>
      <div className={`nbe-editor nbe-editor--${layout}`}>
        <div className="nbe-editor__form" aria-label={t("editor.form")} role="region">
          <ModuleForm {...form} registry={registry} issues={issues} onFocusPath={setFocusPath} />
        </div>
        {layout !== "form" && (
          <div className="nbe-editor__preview" role="region" aria-label={t("editor.preview")}>
            {!result.success && preview && (
              <p className="nbe-note">{t("editor.preview.lastValid")}</p>
            )}
            {preview && (
              <ModuleRenderer
                config={preview}
                registry={registry}
                mode="preview"
                focus={focusPath ? { path: focusPath } : null}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
