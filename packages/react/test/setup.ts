import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import type * as Lifecycle from "../src/hooks/useModuleLifecycle";

// The screen-reader live region repeats feedback text shortly after it appears on screen.
// Text queries skip it so they do not depend on timing; tests that check announcements
// query the region by role.
configure({ defaultIgnore: "script, style, .nb-sr-only[aria-live]" });

// Every event emitted by a module in any test must match its documented payload schema.
const invalidEvents: string[] = [];
// …and every completed gradable module must get the same score from `gradeModule()`.
const gradeMismatches: string[] = [];
vi.mock("../src/hooks/useModuleLifecycle", async (importOriginal) => {
  const original = await importOriginal<typeof Lifecycle>();
  const { validateEventPayload, formatIssues, gradeModule, isGradable } =
    await import("@nibblearn/core");
  return {
    ...original,
    useModuleLifecycle: (options: Parameters<typeof original.useModuleLifecycle>[0]) =>
      original.useModuleLifecycle({
        ...options,
        onEvent: (event) => {
          const res = validateEventPayload(event);
          if (!res.success)
            invalidEvents.push(`${event.moduleType} ${event.type}: ${formatIssues(res.issues)}`);
          options.onEvent?.(event);
        },
        onComplete: (result) => {
          // Grading the reported response without a browser must give the component's score.
          // (A config for host evaluation holds no answers: the host grades with its own copy.)
          const external =
            (options.config as { behavior?: { evaluation?: string } } | undefined)?.behavior
              ?.evaluation === "external";
          if (isGradable(result.moduleType) && result.response && !external) {
            const graded = gradeModule(options.config, result.response);
            const where = `${result.moduleType} ${JSON.stringify(result.response)}`;
            if (!graded.success)
              gradeMismatches.push(`${where}: ${graded.reason} ${formatIssues(graded.issues)}`);
            else {
              const { grade } = graded;
              const same = (a?: number, b?: number) =>
                a === undefined || b === undefined ? a === b : Math.abs(a - b) < 1e-6;
              if (!same(grade.score, result.score))
                gradeMismatches.push(`${where}: score ${grade.score}, component ${result.score}`);
              if (result.correct !== undefined && grade.correct !== result.correct)
                gradeMismatches.push(
                  `${where}: correct ${grade.correct}, component ${result.correct}`,
                );
              if (result.total !== undefined && grade.total !== result.total)
                gradeMismatches.push(`${where}: total ${grade.total}, component ${result.total}`);
            }
          }
          options.onComplete?.(result);
        },
      }),
  };
});

afterEach(() => {
  cleanup();
  if (invalidEvents.length) {
    const found = invalidEvents.splice(0);
    throw new Error(`Invalid event payloads:\n${found.join("\n")}`);
  }
  if (gradeMismatches.length) {
    const found = gradeMismatches.splice(0);
    throw new Error(`gradeModule() disagrees with the component:\n${found.join("\n")}`);
  }
});

// jsdom lacks these browser APIs used by motion / dnd-kit / our hooks.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
}
if (!("IntersectionObserver" in globalThis)) {
  (globalThis as unknown as { IntersectionObserver: typeof RO }).IntersectionObserver = RO;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!(Element.prototype as { scrollTo?: unknown }).scrollTo) {
  (Element.prototype as unknown as { scrollTo: () => void }).scrollTo = () => {};
}
