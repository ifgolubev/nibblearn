import { Suspense, type ReactNode } from "react";
import type { ModuleRegistry } from "./registry";
import type { ModuleProps } from "./modules/types";
import { defaultRegistry } from "./defaultRegistry";
import { useNibblearn } from "./context/NibblearnProvider";

export interface ModuleRendererProps extends ModuleProps<{ id: string; type: string }> {
  /** Registry used to resolve `config.type`. Defaults to all built-in modules. */
  registry?: ModuleRegistry;
  /** Shown while a lazy module loads. */
  fallback?: ReactNode;
}

/**
 * Render any module config by its `type` through a registry.
 * The default registry is imported directly (no global side effects), so this works
 * in tree-shaken and code-split bundles.
 */
// Components come from a stable registry map; they are not created during render.
/* eslint-disable react-hooks/static-components */
export function ModuleRenderer({
  config,
  registry = defaultRegistry,
  fallback = null,
  ...rest
}: ModuleRendererProps) {
  const { theme } = useNibblearn();
  const Component = registry.component(config.type);
  if (!Component) {
    return (
      <div className="nb-root nb-invalid" role="alert" data-nb-theme={theme}>
        <div className="nb-invalid__title">
          Unknown module type: <code>{config.type}</code>
        </div>
      </div>
    );
  }
  return (
    <Suspense fallback={fallback}>
      <Component config={config} {...rest} />
    </Suspense>
  );
}
/* eslint-enable react-hooks/static-components */
