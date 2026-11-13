import { useCallback, useEffect, useMemo, useState } from "react";
import type { ValidationIssue } from "@nibblearn/core";

export function useJsonState<T>(
  initial: string,
  validate: (value: unknown) => { success: boolean; data?: T; issues: ValidationIssue[] },
) {
  const [text, setText] = useState(initial);
  const [debounced, setDebounced] = useState(initial);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(text), 250);
    return () => clearTimeout(id);
  }, [text]);
  const parsed = useMemo(() => {
    try {
      return { value: JSON.parse(debounced) as unknown, error: null as string | null };
    } catch (e) {
      return { value: null, error: (e as Error).message };
    }
  }, [debounced]);
  const result = useMemo(() => (parsed.error ? null : validate(parsed.value)), [parsed, validate]);
  const issues = result ? result.issues : [];
  const data = result?.success ? (result.data as T) : null;
  const reset = useCallback((next: string) => {
    setText(next);
    setDebounced(next);
  }, []);
  return { text, setText, reset, parseError: parsed.error, issues, data };
}
