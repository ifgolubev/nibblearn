import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { moduleBaseShape, validateLesson } from "@nibblearn/core";
import { ModuleRegistry } from "./registry";
import { ModuleRenderer } from "./ModuleRenderer";
import { defaultRegistry } from "./defaultRegistry";
import { LessonPlayer } from "./player/LessonPlayer";
import { ModuleShell } from "./primitives/ModuleShell";
import { Button } from "./primitives/Button";
import { useModuleLifecycle } from "./hooks/useModuleLifecycle";
import type { ModuleProps } from "./modules/types";

const pollSchema = z.object({
  ...moduleBaseShape,
  type: z.literal("poll"),
  content: z.object({ question: z.string(), options: z.array(z.string()).min(2) }),
});
type PollConfig = z.infer<typeof pollSchema>;

function Poll({ config, onComplete, onEvent, resetKey }: ModuleProps<PollConfig>) {
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "poll",
    onComplete,
    onEvent,
    resetKey,
  });
  return (
    <ModuleShell type="poll" id={config.id} title={config.title}>
      <p>{config.content.question}</p>
      {config.content.options.map((o) => (
        <Button key={o} onClick={() => life.complete({ details: { choice: o } })}>
          {o}
        </Button>
      ))}
    </ModuleShell>
  );
}

const pollDef = {
  type: "poll",
  name: "Poll",
  description: "One-question poll",
  category: "practice" as const,
  schema: pollSchema,
};

const pollModule = {
  id: "p",
  type: "poll",
  title: "Quick poll",
  content: { question: "Tea or coffee?", options: ["Tea", "Coffee"] },
};

describe("ModuleRegistry + custom modules", () => {
  it("has every built-in module with a component and a schema", () => {
    expect(defaultRegistry.list().length).toBeGreaterThanOrEqual(22);
    for (const def of defaultRegistry.list()) {
      expect(defaultRegistry.component(def.type), def.type).toBeTruthy();
      expect(defaultRegistry.schemas.has(def.type), def.type).toBe(true);
    }
    expect(defaultRegistry.byCategory("simulate").map((d) => d.type)).toContain(
      "what-if-simulator",
    );
    expect(defaultRegistry.has("nope")).toBe(false);
    expect(defaultRegistry.component("nope")).toBeUndefined();
  });

  it("renders a registered custom module and reports completion", async () => {
    const user = userEvent.setup();
    const registry = new ModuleRegistry([
      ...defaultRegistry.list(),
      { ...pollDef, component: Poll },
    ]);
    const onComplete = vi.fn();
    render(
      <ModuleRenderer
        registry={registry}
        config={pollSchema.parse(pollModule)}
        onComplete={onComplete}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Coffee" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0]).toMatchObject({
      moduleId: "p",
      moduleType: "poll",
      details: { choice: "Coffee" },
    });
  });

  it("supports lazily loaded modules", async () => {
    const load = vi.fn(async () => ({ default: Poll }));
    const registry = new ModuleRegistry([{ ...pollDef, load }]);
    render(
      <ModuleRenderer
        registry={registry}
        config={pollSchema.parse(pollModule)}
        fallback={<p>Loading module…</p>}
      />,
    );
    expect(screen.getByText("Loading module…")).toBeInTheDocument();
    expect(await screen.findByText("Tea or coffee?")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("shows an alert for unknown module types instead of crashing", () => {
    render(<ModuleRenderer config={{ id: "x", type: "does-not-exist" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("does-not-exist");
  });

  it("validates and plays lessons that mix custom and built-in modules", async () => {
    const user = userEvent.setup();
    const registry = new ModuleRegistry([
      ...defaultRegistry.list(),
      { ...pollDef, component: Poll },
    ]);
    const lesson = {
      schemaVersion: 1,
      id: "custom",
      title: "Custom lesson",
      intro: { show: false },
      modules: [
        pollModule,
        {
          id: "tf",
          type: "true-false",
          content: { statements: [{ text: "Sky is blue", isTrue: true }] },
        },
      ],
    };
    // Unknown to the default registry, valid with the custom one.
    expect(validateLesson(lesson).success).toBe(false);
    expect(validateLesson(lesson, { registry: registry.schemas }).success).toBe(true);
    const bad = validateLesson(
      {
        ...lesson,
        modules: [{ ...pollModule, content: { question: "?", options: ["only one"] } }],
      },
      { registry: registry.schemas },
    );
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.issues[0]?.path).toBe("modules[0].content.options");

    render(<LessonPlayer lesson={lesson} registry={registry} storage={false} />);
    await user.click(await screen.findByRole("button", { name: "Tea" }));
    await user.click(await screen.findByRole("button", { name: "Next" }));
    expect(await screen.findByText("Sky is blue")).toBeInTheDocument();
  });
});
