import type { BuiltInModuleInput } from "../schema/lesson";
import type { BuiltInModuleType } from "../schema/registry";

/** The input (authoring) form of a built-in module config, by type. */
export type ModuleInputFor<T extends string> = Extract<BuiltInModuleInput, { type: T }>;

/** One config per built-in module type. */
export type ModuleInputMap = { readonly [T in BuiltInModuleType]: ModuleInputFor<T> };
