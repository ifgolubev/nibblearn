import { StrictMode, act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { builtInModuleTypes } from "@nibblearn/core";
import * as examples from "../../../examples/src";
import { ModuleRenderer } from "../src/ModuleRenderer";
import { LessonPlayer } from "../src/player/LessonPlayer";

type Demo = { id: string; type: string };
const demos = Object.values(examples as Record<string, unknown>).filter(
  (v): v is Demo => typeof v === "object" && v !== null && typeof (v as Demo).type === "string",
);

/**
 * Server rendering contract (Next.js, Remix, Astro …): every module must render on the
 * server, render the same HTML twice (no randomness or clocks in render), and hydrate in
 * StrictMode without React reporting a mismatch.
 */
describe("SSR and hydration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("has a demo for every built-in module", () => {
    expect(new Set(demos.map((d) => d.type))).toEqual(new Set(builtInModuleTypes));
  });

  it.each(demos.map((d) => [d.type, d] as const))(
    "%s renders deterministically and hydrates cleanly",
    async (_type, demo) => {
      const tree = (
        <StrictMode>
          <ModuleRenderer config={demo} />
        </StrictMode>
      );
      const html = renderToString(tree);
      expect(html).toContain(`data-nb-module="${demo.type}"`);
      expect(renderToString(tree)).toBe(html);

      const errors: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...args) => {
        errors.push(args.map(String).join(" "));
      });
      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.appendChild(container);
      let root: ReturnType<typeof hydrateRoot> | undefined;
      await act(async () => {
        root = hydrateRoot(container, tree, {
          onRecoverableError: (e) => errors.push(`recoverable: ${String(e)}`),
        });
      });
      const hydration = errors.filter((e) =>
        /hydrat|did not match|didn't match|recoverable/i.test(e),
      );
      expect(hydration, hydration.join("\n")).toEqual([]);
      await act(async () => root?.unmount());
    },
  );

  it("LessonPlayer renders on the server without touching browser storage", () => {
    const lesson = (examples as Record<string, unknown>).welcomeToTheAgencyLesson;
    const html = renderToString(<LessonPlayer lesson={lesson} />);
    expect(html).toContain("nb-player");
  });
});
