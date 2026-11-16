import { createRoot, type Root } from "react-dom/client";
import {
  InvalidModule,
  ModuleRenderer,
  NibblearnProvider,
  migrateModule,
  type ModuleRegistry,
  type ModuleResult,
  type ModuleState,
  type NibblearnEvent,
  type NibblearnProviderProps,
  useTranslator,
  type ValidationIssue,
} from "@nibblearn/react";

export interface HydrateOptions {
  /** Registry used to resolve module types. Defaults to the built-in modules. */
  registry?: ModuleRegistry;
  /** Provider settings (theme, accent, messages, resolveAsset…). The provider renders no wrapper. */
  provider?: Omit<NibblearnProviderProps, "children" | "wrapper">;
  onEvent?: (event: NibblearnEvent, element: Element) => void;
  onComplete?: (result: ModuleResult, element: Element) => void;
  /** Saved session for a module (see `ModuleState`). */
  getInitialState?: (moduleId: string, element: Element) => ModuleState | null | undefined;
  onStateChange?: (state: ModuleState, element: Element) => void;
}

export interface HydrateResult {
  /** The elements that were mounted by this call. */
  elements: Element[];
  /** Unmount every element mounted by this call. */
  unmount: () => void;
}

/** Elements this library renders into, with their React roots. */
const roots = new WeakMap<Element, Root>();
/** Options given to `hydrate` / `mountElement` for an element; they survive a re-mount. */
const elementOptions = new WeakMap<Element, HydrateOptions>();
/** Options given to `defineNibblearnElement`, per tag name (the latest call wins). */
const tagOptions = new Map<string, HydrateOptions>();

const SELECTOR = "nibblearn-module, [data-nibblearn-module]";

/** Message keys (see `embed.*` in the messages) for config problems. */
type ConfigProblem = "embed.noConfig" | "embed.invalidJson" | "embed.unreadable" | "embed.noType";

class ConfigError extends Error {
  constructor(readonly key: ConfigProblem) {
    super(key);
  }
}

/**
 * Text of the child config script, remembered per element: React replaces the element's
 * children on the first render, so a later re-mount (the element was moved, `hydrate` ran
 * again) must not depend on the script still being there.
 */
const scriptConfigs = new WeakMap<Element, string>();

/** Read the module config from a child `<script type="application/json">` or the `config` attribute. */
function readConfig(el: Element): unknown {
  const script = [...el.children].find(
    (c) =>
      c.tagName === "SCRIPT" && (c.getAttribute("type") ?? "").toLowerCase() === "application/json",
  );
  if (script?.textContent != null) scriptConfigs.set(el, script.textContent);
  const text = scriptConfigs.get(el) ?? el.getAttribute("config") ?? el.getAttribute("data-config");
  if (text == null || !text.trim()) throw new ConfigError("embed.noConfig");
  try {
    return JSON.parse(text);
  } catch {
    throw new ConfigError("embed.invalidJson");
  }
}

/** InvalidModule with a translated config problem. */
function ConfigProblemView({ problem }: { problem: ConfigProblem }) {
  const t = useTranslator();
  return <InvalidModule issues={[{ path: "(root)", message: t(problem) }]} />;
}

const emitDom = (el: Element, name: string, detail: unknown) =>
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));

/** Render (or re-render) one element. `config` overrides what the element contains. */
export function mountElement(el: Element, options: HydrateOptions = {}, config?: unknown): void {
  elementOptions.set(el, options);
  render(el, options, config);
}

/** Options for an element rendered by the custom element: its own, else its tag's. */
const optionsFor = (el: Element, tagName: string): HydrateOptions =>
  elementOptions.get(el) ?? tagOptions.get(tagName) ?? {};

function render(el: Element, options: HydrateOptions, config?: unknown): void {
  let raw: unknown = config;
  let problem: ConfigProblem | null = null;
  if (raw === undefined) {
    try {
      raw = readConfig(el);
    } catch (e) {
      problem = e instanceof ConfigError ? e.key : "embed.unreadable";
    }
  }
  let root = roots.get(el);
  if (!root) {
    // React replaces the element's content (the static fallback and the config script).
    root = createRoot(el);
    roots.set(el, root);
  }
  const isObject =
    typeof raw === "object" && raw !== null && typeof (raw as { type?: unknown }).type === "string";
  const renderIssues = (issues: ValidationIssue[] | null, key: ConfigProblem | null) =>
    root.render(
      <NibblearnProvider {...options.provider} wrapper={false}>
        {key ? <ConfigProblemView problem={key} /> : <InvalidModule issues={issues ?? []} />}
      </NibblearnProvider>,
    );
  if (problem || !isObject) {
    renderIssues(null, problem ?? "embed.noType");
    return;
  }
  const migrated = migrateModule(raw, { registry: options.registry?.schemas });
  // A config that cannot be migrated (e.g. saved by a newer version) is not rendered as-is.
  if (!migrated.success) {
    renderIssues(migrated.issues, null);
    return;
  }
  const moduleConfig = migrated.data as { id: string; type: string };
  const id = typeof moduleConfig.id === "string" ? moduleConfig.id : "";
  root.render(
    <NibblearnProvider {...options.provider} wrapper={false}>
      <ModuleRenderer
        config={moduleConfig}
        registry={options.registry}
        initialState={options.getInitialState?.(id, el) ?? undefined}
        onEvent={(event: NibblearnEvent) => {
          options.onEvent?.(event, el);
          emitDom(el, "nibblearn:event", event);
        }}
        onComplete={(result: ModuleResult) => {
          options.onComplete?.(result, el);
          emitDom(el, "nibblearn:complete", result);
        }}
        onStateChange={(state: ModuleState) => {
          options.onStateChange?.(state, el);
          emitDom(el, "nibblearn:statechange", state);
        }}
      />
    </NibblearnProvider>,
  );
}

/** Unmount one element rendered by `hydrate`, `mountElement` or the custom element. */
export function unmountElement(el: Element): void {
  const root = roots.get(el);
  if (!root) return;
  roots.delete(el);
  root.unmount();
}

/**
 * Find `<nibblearn-module>` and `[data-nibblearn-module]` elements under `root` and render a
 * module into each. Elements that are already mounted are skipped.
 */
export function hydrate(root: ParentNode = document, options: HydrateOptions = {}): HydrateResult {
  // Elements already rendered by `hydrate` / `mountElement` are skipped; ones the custom
  // element rendered on its own are re-rendered with these options.
  const elements = [...root.querySelectorAll(SELECTOR)].filter(
    (el) => !roots.has(el) || !elementOptions.has(el),
  );
  for (const el of elements) mountElement(el, options);
  return {
    elements,
    unmount: () => {
      for (const el of elements) unmountElement(el);
    },
  };
}

/**
 * Register the `<nibblearn-module>` custom element (or another tag name). The element reads
 * its config from a child `<script type="application/json">`, the `config` attribute or the
 * `config` property, and dispatches `nibblearn:event`, `nibblearn:complete` and
 * `nibblearn:statechange` DOM events. Safe to call more than once and on the server (no-op).
 */
export function defineNibblearnElement(
  tagName = "nibblearn-module",
  options: HydrateOptions = {},
): void {
  if (typeof window === "undefined" || typeof customElements === "undefined") return;
  if (customElements.get(tagName)) {
    // Defined before (e.g. by the standalone script): later options apply to its elements.
    if (!tagOptions.has(tagName)) return;
    tagOptions.set(tagName, options);
    for (const el of document.querySelectorAll(tagName))
      if (roots.has(el) && !elementOptions.has(el))
        render(el, options, (el as { config?: unknown }).config);
    return;
  }
  tagOptions.set(tagName, options);

  class NibblearnModuleElement extends HTMLElement {
    static observedAttributes = ["config"];
    #config: unknown = undefined;
    #connected = false;

    get config(): unknown {
      return this.#config;
    }
    set config(value: unknown) {
      this.#config = value;
      if (this.#connected) render(this, optionsFor(this, tagName), value);
    }

    connectedCallback() {
      // A `config` property set before the element was upgraded is an own property that
      // shadows the setter: move it to the private field.
      if (Object.prototype.hasOwnProperty.call(this, "config")) {
        const value = (this as unknown as { config: unknown }).config;
        delete (this as unknown as { config?: unknown }).config;
        this.#config = value;
      }
      this.#connected = true;
      const mount = () => {
        if (this.#connected) render(this, optionsFor(this, tagName), this.#config);
      };
      // Children (the config script) may not be parsed yet while the document is loading.
      if (
        this.#config === undefined &&
        document.readyState === "loading" &&
        !this.hasAttribute("config")
      )
        document.addEventListener("DOMContentLoaded", mount, { once: true });
      else mount();
    }

    disconnectedCallback() {
      this.#connected = false;
      // Unmount after the current task so React is never unmounted while rendering.
      queueMicrotask(() => {
        if (!this.#connected) unmountElement(this);
      });
    }

    attributeChangedCallback(name: string, old: string | null, value: string | null) {
      if (name === "config" && this.#connected && old !== value && this.#config === undefined) {
        // The attribute was changed explicitly: it now wins over a remembered script config.
        scriptConfigs.delete(this);
        render(this, optionsFor(this, tagName));
      }
    }
  }

  customElements.define(tagName, NibblearnModuleElement);
}
