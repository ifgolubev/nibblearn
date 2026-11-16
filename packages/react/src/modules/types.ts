import type { ComponentType } from "react";
import type { ModuleResult, ModuleState, NibblearnEvent } from "@nibblearn/core";
import type { ConfigPath } from "../hooks/useModuleLifecycle";

/** Props every module component accepts. */
export interface ModuleProps<Config> {
  /** Validated (parsed) config with defaults applied. Use `defineModule()` or the schema's `.parse()`. */
  config: Config;
  /** Called once when the module is completed. */
  onComplete?: (result: ModuleResult) => void;
  /** Receives every event emitted by this module. */
  onEvent?: (event: NibblearnEvent) => void;
  /** Change this value to reset the module from the outside. */
  resetKey?: unknown;
  /**
   * Restore a previous session (from `onStateChange`). Ignored when it belongs to another
   * module or to a different version of the config.
   */
  initialState?: ModuleState | null;
  /** Called after every meaningful change with a JSON-serialisable snapshot of the session. */
  onStateChange?: (state: ModuleState) => void;
  /**
   * "preview" is for editors: no events, no `onComplete`, no state snapshots, and steps are
   * not gated by answers. Default "learn".
   */
  mode?: "learn" | "preview";
  /**
   * Preview only: bring this part of the config into view, e.g. `{ path: ["content", "cards", 4] }`.
   * Supported by step-based modules; others ignore it.
   */
  focus?: { path: ConfigPath } | null;
  /** Hide the module's own title/instructions header (e.g. when the player renders them). */
  hideHeader?: boolean;
  className?: string;
}

export type ModuleComponent<Config = unknown> = ComponentType<ModuleProps<Config>>;
