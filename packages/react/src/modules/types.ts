import type { ComponentType } from "react";
import type { NibblearnEvent, ModuleResult } from "@nibblearn/core";

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
  /** Hide the module's own title/instructions header (e.g. when the player renders them). */
  hideHeader?: boolean;
  className?: string;
}

export type ModuleComponent<Config = unknown> = ComponentType<ModuleProps<Config>>;
