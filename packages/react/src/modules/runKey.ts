import { seedFromString } from "@nibblearn/core";
import type { ModuleLifecycle } from "../hooks/useModuleLifecycle";

/** Keys whose string values identify or link items (changing them changes the structure). */
const STRUCTURAL =
  /(^id$|Id$|^next$|^start$|^to$|^correctAction$|^kind$|^type$|^mode$|^layout$|^position$)/;

/**
 * A fingerprint of a config's structure: list lengths, ids and links, numbers and booleans,
 * but not display text. Editing a title or a card's text keeps the module where it is;
 * adding, removing or relinking items starts a fresh run, so the module never points at an
 * item that no longer exists.
 */
export function structureKey(config: unknown): string {
  const json = JSON.stringify(config, (key, value) =>
    typeof value === "string" && !STRUCTURAL.test(key) ? "" : value,
  );
  return seedFromString(json ?? "").toString(36);
}

/** React key for a module's run component: a new run on reset or on a structural edit. */
export function runKey(life: ModuleLifecycle, config: unknown): string {
  return `${life.runId}:${structureKey(config)}`;
}
