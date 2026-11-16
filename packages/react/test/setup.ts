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
vi.mock("../src/hooks/useModuleLifecycle", async (importOriginal) => {
  const original = await importOriginal<typeof Lifecycle>();
  const { validateEventPayload, formatIssues } = await import("@nibblearn/core");
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
      }),
  };
});

afterEach(() => {
  cleanup();
  if (invalidEvents.length) {
    const found = invalidEvents.splice(0);
    throw new Error(`Invalid event payloads:\n${found.join("\n")}`);
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
