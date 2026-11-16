import { render } from "@testing-library/react";
import { latestState } from "./state-helpers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { builtInModuleDefinitions, stateFingerprint, type ModuleState } from "@nibblearn/core";
import * as examples from "../../../examples/src";
import { ModuleRenderer } from "../src/ModuleRenderer";

const demos = Object.values(examples as Record<string, { type?: unknown; id?: string }>).filter(
  (d) => d && typeof d.type === "string",
) as { type: string; id: string }[];

// Values of the wrong type or out of range under every key a module might use.
const garbageData: Record<string, unknown> = JSON.parse(
  JSON.stringify({
    index: 9999,
    pos: -5,
    position: "x",
    selected: { a: 1 },
    checked: "yes",
    revealed: 1,
    records: [{ score: 7 }],
    qAttempts: -1,
    finished: "no",
    order: [null, 5],
    placements: [1, 2],
    assignments: { "": 99 },
    answers: 12,
    flipped: "true",
    opened: [{}],
    shares: { x: "y" },
    guess: Number.MAX_SAFE_INTEGER,
  }),
);
// A JSON "__proto__" key becomes an own property, exactly as with stored state.
Object.assign(garbageData, JSON.parse('{"__proto__": {"polluted": true}, "constructor": 1}'));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("initialState is untrusted", () => {
  it.each(demos.map((d) => [d.type, d] as const))("%s survives malformed state", (type, demo) => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const def = builtInModuleDefinitions.find((d) => d.type === type)!;
    const configHash = stateFingerprint(def.schema.parse(demo));
    const states: unknown[] = [
      { v: 2 },
      "not an object",
      null,
      {
        v: 1,
        moduleId: demo.id,
        moduleType: type,
        configHash: "other",
        run: 0,
        attempts: 0,
        result: null,
        data: {},
      },
      {
        v: 1,
        moduleId: demo.id,
        moduleType: type,
        configHash,
        run: -1,
        attempts: 0,
        result: null,
        data: {},
      },
      {
        v: 1,
        moduleId: demo.id,
        moduleType: type,
        configHash,
        run: 0,
        attempts: 0,
        result: { status: "completed", moduleId: "someone-else", attempts: 1 },
        data: {},
      },
      {
        v: 1,
        moduleId: demo.id,
        moduleType: type,
        configHash,
        run: 2,
        attempts: 3,
        result: null,
        data: garbageData,
      },
    ];
    for (const state of states) {
      const { container, unmount } = render(
        <ModuleRenderer config={demo} initialState={state as ModuleState} />,
      );
      expect(container.querySelector(`[data-nb-module="${type}"]`)).not.toBeNull();
      unmount();
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(errors).not.toHaveBeenCalled();
  });
});

describe("restoring is all or nothing", () => {
  const tf = demos.find((d) => d.type === "true-false")!;
  const sort = demos.find((d) => d.type === "category-sort")!;
  const stateFor = (config: { id: string; type: string }, data: Record<string, unknown>) =>
    ({
      v: 1,
      moduleId: config.id,
      moduleType: config.type,
      configHash: stateFingerprint(
        builtInModuleDefinitions.find((d) => d.type === config.type)!.schema.parse(config),
      ),
      run: 0,
      attempts: 0,
      result: null,
      data,
    }) as ModuleState;

  it("starts a fresh run when one saved value fails its check", async () => {
    const onStateChange = vi.fn();
    render(
      <ModuleRenderer
        config={tf}
        initialState={stateFor(tf, { pos: 1, finished: "nope" })}
        onStateChange={onStateChange}
      />,
    );
    const state = await latestState(onStateChange);
    expect(state.run).toBe(1);
    expect(state.data.pos).toBe(0);
  });

  it("restores a session passed back in memory with undefined record values", async () => {
    const onStateChange = vi.fn();
    const first = (sort as unknown as { content: { items: { id: string; categoryId: string }[] } })
      .content.items[0]!;
    render(
      <ModuleRenderer
        config={sort}
        initialState={stateFor(sort, {
          assignments: { [first.id]: first.categoryId, [`${first.id}-x`]: undefined },
          lockedIds: [],
        })}
        onStateChange={onStateChange}
      />,
    );
    await new Promise((r) => setTimeout(r, 0));
    const calls = onStateChange.mock.calls.map((c) => (c[0] as ModuleState).run);
    expect(calls.every((run) => run === 0)).toBe(true);
  });
});

describe("StrictMode", () => {
  it("keeps a restored session and emits no reset when effects run twice", async () => {
    const { StrictMode } = await import("react");
    const tf = demos.find((d) => d.type === "true-false")!;
    const onStateChange = vi.fn();
    const first = render(<ModuleRenderer config={tf} onStateChange={onStateChange} />);
    const saved = await latestState(onStateChange);
    first.unmount();
    const restored = { ...saved, data: { ...saved.data, pos: 1 } };

    const onEvent = vi.fn();
    const onChange = vi.fn();
    render(
      <StrictMode>
        <ModuleRenderer
          config={tf}
          initialState={restored}
          onEvent={onEvent}
          onStateChange={onChange}
        />
      </StrictMode>,
    );
    await new Promise((r) => setTimeout(r, 20));
    const types = onEvent.mock.calls.map((c) => c[0].type);
    expect(types).not.toContain("module:reset");
    expect(types).not.toContain("module:start");
    for (const [state] of onChange.mock.calls) {
      expect((state as ModuleState).run).toBe(restored.run);
      expect((state as ModuleState).data.pos).toBe(1);
    }
  });
});

describe("a session belongs to one module and config", () => {
  it("is not replayed into another module or a structurally edited config", async () => {
    const tf = demos.find((d) => d.type === "true-false")! as unknown as {
      id: string;
      type: string;
      content: { statements: { isTrue: boolean }[] };
    };
    const onStateChange = vi.fn();
    const first = render(<ModuleRenderer config={tf} onStateChange={onStateChange} />);
    await latestState(onStateChange);
    first.unmount();
    const saved = {
      ...(onStateChange.mock.calls.at(-1)![0] as ModuleState),
      data: { pos: 2 },
    };

    const other = { ...tf, id: "tf-other" };
    const changes = vi.fn();
    const view = render(
      <ModuleRenderer config={tf} initialState={saved} onStateChange={changes} />,
    );
    view.rerender(<ModuleRenderer config={other} initialState={saved} onStateChange={changes} />);
    const otherState = await latestState(changes);
    expect(otherState.moduleId).toBe("tf-other");
    expect(otherState.data.pos).toBe(0);

    const edited = structuredClone(tf);
    edited.content.statements[0]!.isTrue = !edited.content.statements[0]!.isTrue;
    const editedChanges = vi.fn();
    view.rerender(
      <ModuleRenderer config={edited} initialState={saved} onStateChange={editedChanges} />,
    );
    const editedState = await latestState(editedChanges);
    expect(editedState.data.pos).toBe(0);
  });
});

describe("time spent", () => {
  it("continues after a restore", async () => {
    const callout = demos.find((d) => d.type === "callout")!;
    const def = builtInModuleDefinitions.find((d) => d.type === "callout")!;
    const saved: ModuleState = {
      v: 1,
      moduleId: callout.id,
      moduleType: "callout",
      configHash: stateFingerprint(def.schema.parse(callout)),
      run: 0,
      attempts: 0,
      result: null,
      data: {},
      elapsedMs: 60_000,
    };
    const onComplete = vi.fn();
    render(<ModuleRenderer config={callout} initialState={saved} onComplete={onComplete} />);
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onComplete.mock.calls[0]![0].durationMs).toBeGreaterThanOrEqual(60_000);
  });
});
