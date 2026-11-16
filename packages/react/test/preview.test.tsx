import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { builtInModuleTypes, stripMarkup } from "@nibblearn/core";
import { createEmpty, createExample } from "@nibblearn/core/examples";
import { ModuleRenderer } from "../src/ModuleRenderer";

describe("editing a config does not reset the module", () => {
  it("story-cards keeps the current card when a card's text changes", async () => {
    const user = userEvent.setup();
    const config = createExample("story-cards");
    const { rerender } = render(<ModuleRenderer config={config} />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText(/Card 2 of/)).toBeInTheDocument();
    const edited = structuredClone(config);
    edited.content.cards[0]!.title = "Edited title";
    rerender(<ModuleRenderer config={edited} />);
    expect(screen.getByText(/Card 2 of/)).toBeInTheDocument();
  });

  it("story-cards stays valid when the current card is removed", async () => {
    const user = userEvent.setup();
    const config = createExample("story-cards");
    const { rerender } = render(<ModuleRenderer config={config} />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText(/Card 2 of/)).toBeInTheDocument();
    const edited = structuredClone(config);
    edited.content.cards = edited.content.cards.slice(0, 1);
    rerender(<ModuleRenderer config={edited} />);
    // A structural edit starts a fresh run on the first card instead of pointing at a removed one.
    expect(screen.queryByText(/Card 2 of/)).not.toBeInTheDocument();
    expect(document.querySelector('[data-nb-module="story-cards"]')).not.toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

/** Change every display string (keeping ids and links) to simulate typing in an editor. */
function editTexts<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (key, v) =>
      typeof v === "string" &&
      !/(^id$|Id$|^next$|^start$|^to$|^type$|^kind$|src|^correctAction$|^formula$|^when$|^template$|^answers$|^tokens$)/.test(
        key,
      ) &&
      !/^(?:[a-z]+:|#|data:)/.test(v)
        ? `${v} (edited)`
        : v,
    ),
  ) as T;
}

describe("every module survives live edits", () => {
  it.each(builtInModuleTypes)("%s", (type) => {
    const example = createExample(type);
    const { rerender, container } = render(<ModuleRenderer config={example} />);
    rerender(<ModuleRenderer config={editTexts(example)} />);
    rerender(<ModuleRenderer config={createEmpty(type, { id: example.id })} />);
    rerender(<ModuleRenderer config={example} />);
    expect(container.querySelector(`[data-nb-module="${type}"]`)).not.toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any -- example configs indexed generically */
// Visible text of item `i` for each module that supports `focus`.
const focusCases: [string, string, (c: any, i: number) => string][] = [
  ["story-cards", "cards", (c, i) => c.content.cards[i].title ?? c.content.cards[i].body],
  ["choice-challenge", "questions", (c, i) => c.content.questions[i].prompt],
  ["true-false", "statements", (c, i) => c.content.statements[i].text],
  ["flashcards", "cards", (c, i) => c.content.cards[i].front],
  ["estimate", "questions", (c, i) => c.content.questions[i].prompt],
  ["process-explorer", "stages", (c, i) => c.content.stages[i].title],
  ["screenshot-walkthrough", "steps", (c, i) => c.content.steps[i].instruction],
  ["word-builder", "items", (c, i) => c.content.items[i].prompt],
  ["inbox-triage", "messages", (c, i) => c.content.messages[i].subject],
  [
    "hotspot-explorer",
    "hotspots",
    (c, i) => c.content.hotspots[i].title ?? c.content.hotspots[i].label,
  ],
];

const visible = (text: string) =>
  (document.body.textContent ?? "")
    .replace(/\s+/g, " ")
    .includes(stripMarkup(text).replace(/\s+/g, " "));

describe("preview mode with focus", () => {
  it.each(focusCases)(
    "%s shows the focused item and follows focus changes",
    async (type, list, textOf) => {
      const config = createExample(type as never) as any;
      const count = config.content[list].length;
      const third = Math.min(2, count - 1);
      const onEvent = vi.fn();
      const onComplete = vi.fn();
      const onStateChange = vi.fn();
      const props = { onEvent, onComplete, onStateChange, mode: "preview" as const };
      const { rerender } = render(
        <ModuleRenderer config={config} {...props} focus={{ path: ["content", list, third] }} />,
      );
      expect(visible(textOf(config, third))).toBe(true);
      rerender(
        <ModuleRenderer config={config} {...props} focus={{ path: ["content", list, 0] }} />,
      );
      // Item transitions animate out before the next item mounts.
      await waitFor(() => expect(visible(textOf(config, 0))).toBe(true));
      expect(onEvent).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
      expect(onStateChange).not.toHaveBeenCalled();
    },
  );

  it("story-cards lets editors move past unanswered checks", async () => {
    const user = userEvent.setup();
    const config = createExample("story-cards");
    const withCheck = config.content.cards.findIndex((c) => c.check);
    render(
      <ModuleRenderer
        config={config}
        mode="preview"
        focus={{ path: ["content", "cards", withCheck] }}
      />,
    );
    expect(screen.getByRole("button", { name: /Next|Finish/ })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /Next|Finish/ }));
  });

  it("ignores focus outside preview mode", () => {
    const config = createExample("story-cards");
    render(<ModuleRenderer config={config} focus={{ path: ["content", "cards", 2] }} />);
    expect(screen.getByText(/Card 1 of/)).toBeInTheDocument();
  });
});

describe("modules never take focus while previewed or restored", () => {
  it.each(focusCases)(
    "%s in preview keeps focus in the author's field",
    async (type, list, textOf) => {
      const config = createExample(type as never) as any;
      const input = document.createElement("input");
      document.body.append(input);
      input.focus();
      const count = config.content[list].length;
      const { rerender } = render(
        <ModuleRenderer config={config} mode="preview" focus={{ path: ["content", list, 0] }} />,
      );
      for (let i = 1; i < Math.min(count, 3); i++) {
        rerender(
          <ModuleRenderer config={config} mode="preview" focus={{ path: ["content", list, i] }} />,
        );
        await waitFor(() => expect(visible(textOf(config, i))).toBe(true));
        await new Promise((r) => setTimeout(r, 50));
        expect(document.activeElement).toBe(input);
      }
      input.remove();
    },
  );

  it.each(builtInModuleTypes)("%s does not move focus when restoring a session", async (type) => {
    const config = createExample(type);
    const onStateChange = vi.fn();
    const first = render(<ModuleRenderer config={config} onStateChange={onStateChange} />);
    await new Promise((r) => setTimeout(r, 0));
    const saved = onStateChange.mock.calls.at(-1)?.[0];
    first.unmount();
    if (!saved) return; // block types without progress
    (document.activeElement as HTMLElement | null)?.blur();
    render(<ModuleRenderer config={config} initialState={saved} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.activeElement).toBe(document.body);
  });
});
