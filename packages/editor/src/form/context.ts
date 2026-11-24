import { createContext, useContext } from "react";
import type { ValidationIssue } from "@nibblearn/react";
import type { Path } from "./path";

export interface PickedImage {
  src: string;
  alt?: string;
}

export interface FormContextValue {
  /** Stable prefix for element ids. */
  formId: string;
  /** Module type, for `field.<type>.<path>` label overrides. */
  type: string;
  root: unknown;
  update: (path: Path, value: unknown) => void;
  /** Validation messages for exactly this path. */
  issuesAt: (path: Path) => string[];
  onFocusPath?: (path: (string | number)[]) => void;
  onPickImage?: () => Promise<PickedImage | null>;
  announce: (message: string) => void;
  /** True for fields the host asked not to show (`hideFields`, `hideIds`). */
  isHidden: (path: Path, widget: string | undefined) => boolean;
  /** False when the host asked for a form without help text (`hideDescriptions`). */
  showHelp: boolean;
}

export const FormContext = createContext<FormContextValue | null>(null);

export function useForm(): FormContextValue {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("Form fields must be rendered inside ModuleForm");
  return ctx;
}

/**
 * Matches a field path against patterns like `"appearance"` or `"content.items.*.id"`.
 * `*` stands for exactly one segment (a key or a list index).
 */
export function matchesPath(path: Path, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => {
    const parts = pattern.split(".");
    return (
      parts.length === path.length && parts.every((p, i) => p === "*" || p === String(path[i]))
    );
  });
}

/** DOM id for the control at `path`. */
export const fieldId = (formId: string, path: Path) =>
  `${formId}-${path.map(String).join("-") || "root"}`;

/** Key used to match validation issues to fields. */
export const pathKey = (path: ReadonlyArray<PropertyKey>) => path.map(String).join(".");

export function issueMap(issues: ValidationIssue[] | undefined): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const issue of issues ?? []) {
    const key = issue.segments ? pathKey(issue.segments) : issue.path.replace(/\[(\d+)\]/g, ".$1");
    map.set(key, [...(map.get(key) ?? []), issue.message]);
  }
  return map;
}
