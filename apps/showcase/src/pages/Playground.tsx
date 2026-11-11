import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ModuleRenderer, validateModule, type ModuleConfig } from "@nibblearn/react";
import { JsonEditor } from "@/components/JsonEditor";
import { DemoFrame } from "@/components/DemoFrame";
import { useTitle } from "@/components/Seo";
import { moduleDocs } from "@/lib/moduleDocs";
import { getDemo } from "@/lib/demos";
import { stringify } from "@/lib/code";
import { useJsonState } from "@/lib/usePlaygroundState";

export function PlaygroundPage() {
  useTitle("Playground");
  const [params, setParams] = useSearchParams();
  const available = moduleDocs.filter((m) => getDemo(m.type));
  const initialType =
    params.get("module") && getDemo(params.get("module")!)
      ? params.get("module")!
      : (available[0]?.type ?? "choice-challenge");
  const [type, setType] = useState(initialType);
  const initialJson = useMemo(() => stringify(getDemo(type) ?? {}), [type]);
  const validate = useCallback((v: unknown) => validateModule(v), []);
  const state = useJsonState<ModuleConfig>(initialJson, validate);
  const [lastGood, setLastGood] = useState<ModuleConfig | null>(state.data);
  const [seen, setSeen] = useState<ModuleConfig | null>(state.data);
  const [version, setVersion] = useState(0);
  if (state.data && state.data !== seen) {
    // Derive "last valid config" during render (React-sanctioned pattern, no effect needed).
    setSeen(state.data);
    setLastGood(state.data);
    setVersion(version + 1);
  }

  const choose = (next: string) => {
    setType(next);
    state.reset(stringify(getDemo(next) ?? {}));
    const p = new URLSearchParams(params);
    p.set("module", next);
    setParams(p, { replace: true });
  };

  return (
    <div className="site-container py-10 sm:py-14">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand dark:text-indigo-300">
            Playground
          </p>
          <h1 className="display display-blue mt-3 text-5xl sm:text-6xl">Edit JSON, see it live</h1>
          <p className="mt-3 text-muted">
            Pick a module, change its configuration and watch the preview update. Validation errors
            show exactly which field needs attention.
          </p>
        </div>
        <Link
          to="/playground/lesson"
          className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium hover:bg-surface-2 focus-ring"
        >
          Lesson playground →
        </Link>
      </div>

      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Module">
        {available.map((m) => (
          <button
            key={m.type}
            type="button"
            role="tab"
            aria-selected={type === m.type}
            onClick={() => choose(m.type)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium focus-ring ${type === m.type ? "bg-[var(--site-fg)] text-[var(--site-bg)]" : "bg-surface-2 text-muted hover:text-[var(--site-fg)]"}`}
          >
            {m.name}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <JsonEditor
          value={state.text}
          onChange={state.setText}
          issues={state.issues}
          parseError={state.parseError}
          onReset={() => state.reset(stringify(getDemo(type) ?? {}))}
          fileName={`${type}.json`}
          label="Module configuration"
        />
        <div className="min-w-0">
          <DemoFrame label="Preview" plain>
            {(resetKey) =>
              lastGood ? (
                <ModuleRenderer
                  key={`${lastGood.id}-${version}`}
                  config={lastGood}
                  resetKey={resetKey}
                />
              ) : (
                <div className="p-6 text-center text-sm text-muted">
                  Fix the JSON to see a preview.
                </div>
              )
            }
          </DemoFrame>
          {(state.parseError || state.issues.length > 0) && lastGood && (
            <p className="mt-2 text-xs text-muted">
              Showing the last valid configuration while you edit.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
