import type { ComponentType, LazyExoticComponent } from "react";
import { lazy } from "react";
import {
  builtInModuleDefinitions,
  SchemaRegistry,
  type ModuleCategory,
  type ModuleSchemaDefinition,
} from "@nibblearn/core";
import type { z } from "zod";
import type { ModuleComponent, ModuleProps } from "./modules/types";

export interface ModuleDefinition<
  S extends z.ZodType = z.ZodType,
> extends ModuleSchemaDefinition<S> {
  /** The React component rendering this module. */
  component?: ModuleComponent<z.infer<S>>;
  /** Lazy loader alternative to `component` (code-splitting). */
  load?: () => Promise<{ default: ModuleComponent<z.infer<S>> }>;
}

/**
 * A definition for any module type. Each definition is internally consistent (its component
 * takes the config its schema produces); the registry only needs to store them side by side.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous list of typed definitions
export type AnyModuleDefinition = ModuleDefinition<any>;

/**
 * Registry of module definitions (schema + component). The LessonPlayer and
 * `ModuleRenderer` resolve module types through it. Register custom modules
 * with `register()`.
 */
export class ModuleRegistry {
  private readonly defs = new Map<string, ModuleDefinition>();
  private readonly lazies = new Map<
    string,
    LazyExoticComponent<ComponentType<ModuleProps<unknown>>>
  >();
  readonly schemas: SchemaRegistry;

  constructor(definitions: readonly AnyModuleDefinition[] = []) {
    this.schemas = new SchemaRegistry([]);
    for (const d of definitions) this.register(d);
  }

  register<S extends z.ZodType>(definition: ModuleDefinition<S>): this {
    this.defs.set(definition.type, definition as unknown as ModuleDefinition);
    this.schemas.register(definition);
    this.lazies.delete(definition.type);
    if (!definition.component && definition.load) {
      const load = definition.load;
      this.lazies.set(
        definition.type,
        lazy(() => load() as Promise<{ default: ComponentType<ModuleProps<unknown>> }>),
      );
    }
    return this;
  }

  get(type: string): ModuleDefinition | undefined {
    return this.defs.get(type);
  }

  has(type: string): boolean {
    return this.defs.has(type);
  }

  list(): ModuleDefinition[] {
    return [...this.defs.values()];
  }

  byCategory(category: ModuleCategory): ModuleDefinition[] {
    return this.list().filter((d) => d.category === category);
  }

  /** Resolve the component for a type (lazy definitions are wrapped in React.lazy). */
  component(type: string): ComponentType<ModuleProps<unknown>> | undefined {
    const def = this.defs.get(type);
    if (!def) return undefined;
    if (def.component) return def.component as ComponentType<ModuleProps<unknown>>;
    return this.lazies.get(type);
  }
}

export { builtInModuleDefinitions };
