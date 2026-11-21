import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { builtInModuleTypes, validateModule } from "@nibblearn/core";
import { createEmpty, createExample } from "@nibblearn/core/examples";
import { NibblearnProvider } from "@nibblearn/react";
import { BlockPicker, LessonEditor, ModuleEditor, ModuleForm } from "../src";

/** Paths at which two values differ. */
function diffPaths(a: unknown, b: unknown, path: string[] = []): string[] {
  if (Object.is(a, b)) return [];
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null)
    return [path.join(".")];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].flatMap((k) =>
    diffPaths((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], [...path, k]),
  );
}

function Controlled({
  initial,
  onValue,
}: {
  initial: Record<string, unknown>;
  onValue?: (v: Record<string, unknown>) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <ModuleForm
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
    />
  );
}

describe("ModuleForm", () => {
  it.each(builtInModuleTypes)("%s: renders the example without changing it", (type) => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const onChange = vi.fn();
    const example = createExample(type) as Record<string, unknown>;
    render(<ModuleForm value={example} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it.each(builtInModuleTypes)(
    "%s: editing the first text field changes exactly one path",
    async (type) => {
      const example = createExample(type) as Record<string, unknown>;
      const onValue = vi.fn();
      render(<Controlled initial={example} onValue={onValue} />);
      const input = screen.getAllByRole("textbox")[0]!;
      fireEvent.change(input, { target: { value: `${(input as HTMLInputElement).value}!` } });
      expect(onValue).toHaveBeenCalledTimes(1);
      expect(diffPaths(example, onValue.mock.calls[0]![0])).toHaveLength(1);
    },
  );

  it.each(builtInModuleTypes)("%s: the blank config stays valid in the form", (type) => {
    const blank = createEmpty(type) as Record<string, unknown>;
    render(<ModuleForm value={blank} onChange={() => {}} />);
    expect(validateModule(blank).success).toBe(true);
  });

  it("adds, moves, duplicates and deletes list items", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(
      <Controlled
        initial={createEmpty("flashcards") as Record<string, unknown>}
        onValue={onValue}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Add card" }));
    const cards = () => (onValue.mock.calls.at(-1)![0].content as { cards: unknown[] }).cards;
    expect(cards()).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Duplicate card 1" }));
    expect(cards()).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Move card 1 down" }));
    expect(screen.getByRole("button", { name: "Move card 2 down" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Delete card 3" }));
    expect(cards()).toHaveLength(2);
    await waitFor(() =>
      expect(
        screen.getAllByRole("status").some((el) => /card 3 deleted/i.test(el.textContent ?? "")),
      ).toBe(true),
    );
  });

  it("shows validation issues next to fields and in a summary", async () => {
    const user = userEvent.setup();
    const broken = { ...createExample("estimate"), id: "e" } as Record<string, unknown>;
    (broken.content as { questions: { min: number; max: number }[] }).questions[0]!.max = -1;
    const res = validateModule(broken);
    expect(res.success).toBe(false);
    render(
      <ModuleForm value={broken} onChange={() => {}} issues={res.success ? [] : res.issues} />,
    );
    const summary = screen.getByRole("group", { name: /Fix \d+ problem/ });
    const link = within(summary).getAllByRole("button")[0]!;
    await user.click(link);
    expect(document.activeElement?.tagName).toMatch(/INPUT|TEXTAREA|SELECT|BUTTON/);
    expect(document.querySelectorAll("[aria-invalid='true']").length).toBeGreaterThan(0);
  });

  it("formats rich text from the toolbar", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    const example = createEmpty("story-cards") as Record<string, unknown>;
    render(<Controlled initial={example} onValue={onValue} />);
    const toolbar = screen.getAllByRole("toolbar")[0]!;
    await user.click(within(toolbar).getByRole("button", { name: "Bold" }));
    const changed = diffPaths(example, onValue.mock.calls.at(-1)![0]);
    expect(changed).toHaveLength(1);
  });
});

describe("ModuleEditor", () => {
  it("previews the last valid version and follows the focused item", async () => {
    function Host() {
      const [value, setValue] = useState(createExample("flashcards") as Record<string, unknown>);
      return <ModuleEditor value={value} onChange={setValue} />;
    }
    render(<Host />);
    const preview = screen.getByRole("region", { name: "Preview" });
    expect(within(preview).getByText(/1 of/)).toBeInTheDocument();
    // Open the third card and focus one of its fields: the preview follows.
    const form = screen.getByRole("region", { name: "Settings" });
    const items = within(form)
      .getAllByRole("listitem")
      .filter((li) => li.querySelector("[data-action='toggle']"));
    const third = items[2]!;
    const toggle = third.querySelector<HTMLButtonElement>("[data-action='toggle']")!;
    if (toggle.getAttribute("aria-expanded") === "false") fireEvent.click(toggle);
    fireEvent.focus(within(third).getAllByRole("textbox")[0]!);
    await waitFor(() => expect(within(preview).getByText(/3 of/)).toBeInTheDocument());
  });

  it("keeps the preview when the config becomes invalid", () => {
    function Host() {
      const [value, setValue] = useState(createExample("true-false") as Record<string, unknown>);
      return <ModuleEditor value={value} onChange={setValue} />;
    }
    render(<Host />);
    const preview = screen.getByRole("region", { name: "Preview" });
    expect(preview.querySelector("[data-nb-module='true-false']")).not.toBeNull();
    const statement = screen
      .getAllByRole("textbox")
      .find((el) => (el as HTMLTextAreaElement).value.length > 0)!;
    fireEvent.change(statement, { target: { value: "x".repeat(5000) } });
    expect(screen.getByText("Showing the last valid version while you edit.")).toBeInTheDocument();
    expect(preview.querySelector("[data-nb-module='true-false']")).not.toBeNull();
  });
});

describe("BlockPicker", () => {
  it("filters blocks and creates a valid config with a unique id", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<BlockPicker onPick={onPick} existingIds={["flashcards-1"]} />);
    await user.type(screen.getByRole("searchbox", { name: "Search blocks" }), "flash");
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(1);
    await user.click(buttons[0]!);
    const [config, info] = onPick.mock.calls[0]!;
    expect(info).toEqual({ type: "flashcards", from: "example" });
    expect(config.id).toBe("flashcards-2");
    expect(validateModule(config).success).toBe(true);
  });

  it("offers blank configs", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<BlockPicker onPick={onPick} />);
    await user.click(screen.getByRole("radio", { name: "Blank" }));
    await user.click(
      screen.getByRole("button", { name: /^True \/ False|^True or false|^True-false/i }),
    );
    expect(onPick.mock.calls[0]![1].from).toBe("empty");
    expect(validateModule(onPick.mock.calls[0]![0]).success).toBe(true);
  });

  it("says when nothing matches", async () => {
    const user = userEvent.setup();
    render(<BlockPicker onPick={() => {}} />);
    await user.type(screen.getByRole("searchbox"), "zzzz");
    expect(screen.getByText(/No blocks match/)).toBeInTheDocument();
  });
});

describe("LessonEditor", () => {
  it("adds a block, edits lesson settings and reorders blocks", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    function Host() {
      const [value, setValue] = useState<Record<string, unknown>>({
        schemaVersion: 1,
        id: "l",
        title: "Lesson",
        modules: [createEmpty("true-false", { id: "tf" })],
      });
      return (
        <LessonEditor
          value={value}
          onChange={(v) => {
            setValue(v);
            onValue(v);
          }}
        />
      );
    }
    render(<Host />);
    await user.click(screen.getByRole("button", { name: "Add block" }));
    await user.click(screen.getByRole("button", { name: /Flashcards/ }));
    const modules = () => onValue.mock.calls.at(-1)![0].modules as { type: string }[];
    expect(modules().map((m) => m.type)).toEqual(["true-false", "flashcards"]);
    await user.click(screen.getAllByRole("button", { name: /up$/ })[1]!);
    expect(modules().map((m) => m.type)).toEqual(["flashcards", "true-false"]);

    await user.click(screen.getByRole("button", { name: "Lesson settings" }));
    const title = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(title, { target: { value: "Renamed" } });
    expect(onValue.mock.calls.at(-1)![0].title).toBe("Renamed");
    expect(onValue.mock.calls.at(-1)![0].modules).toHaveLength(2);
  });
});

describe("review fixes", () => {
  it("keeps focus while the block id is typed in the lesson editor", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    function Host() {
      const [value, setValue] = useState<Record<string, unknown>>({
        schemaVersion: 1,
        id: "l",
        title: "Lesson",
        modules: [createEmpty("true-false", { id: "tf" })],
      });
      return (
        <LessonEditor
          value={value}
          onChange={(v) => {
            setValue(v);
            onValue(v);
          }}
        />
      );
    }
    render(<Host />);
    const id = screen.getByDisplayValue("tf");
    await user.clear(id);
    await user.type(id, "quiz");
    expect(onValue.mock.calls.at(-1)![0].modules[0].id).toBe("quiz");
    expect(document.activeElement).toBe(id);
    expect(id).toHaveValue("quiz");
  });

  it("lets a required number be cleared and retyped as a negative value", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    const schema = {
      type: "object",
      required: ["n"],
      properties: { n: { type: "number", title: "Amount" } },
    };
    function Host() {
      const [value, setValue] = useState<Record<string, unknown>>({ n: 5 });
      return (
        <ModuleForm
          value={value}
          schema={schema}
          onChange={(v) => {
            setValue(v);
            onValue(v);
          }}
        />
      );
    }
    render(<Host />);
    const input = screen.getByRole("spinbutton", { name: /Amount/ });
    await user.clear(input);
    expect(onValue.mock.calls.every((c) => c[0].n !== 0)).toBe(true);
    await user.type(input, "-5");
    expect(onValue.mock.calls.at(-1)![0].n).toBe(-5);
  });

  it("keeps edits made while the image picker is open", async () => {
    const user = userEvent.setup();
    let pick!: (v: { src: string; alt?: string }) => void;
    const onPickImage = () => new Promise<{ src: string; alt?: string } | null>((r) => (pick = r));
    const onValue = vi.fn();
    function Host() {
      const [value, setValue] = useState<Record<string, unknown>>(
        createExample("hotspot-explorer") as Record<string, unknown>,
      );
      return (
        <ModuleForm
          value={value}
          onPickImage={onPickImage}
          onChange={(v) => {
            setValue(v);
            onValue(v);
          }}
        />
      );
    }
    render(<Host />);
    await user.click(screen.getAllByRole("button", { name: "Choose image" })[0]!);
    fireEvent.change(screen.getAllByRole("textbox", { name: /^Title/ })[0]!, {
      target: { value: "Edited meanwhile" },
    });
    await act(async () => pick({ src: "https://example.com/new.png" }));
    const last = onValue.mock.calls.at(-1)![0];
    expect(last.title).toBe("Edited meanwhile");
    expect(last.content.image.src).toBe("https://example.com/new.png");
  });

  it("edits the right block after the host replaces the lesson", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    const two = {
      schemaVersion: 1,
      id: "l",
      title: "Lesson",
      modules: [createEmpty("true-false", { id: "a" }), createEmpty("callout", { id: "b" })],
    };
    const one = { ...two, modules: [createEmpty("flashcards", { id: "c" })] };
    function Host() {
      const [value, setValue] = useState<Record<string, unknown>>(two);
      return (
        <>
          <button type="button" onClick={() => setValue(one)}>
            Swap lesson
          </button>
          <LessonEditor
            value={value}
            onChange={(v) => {
              setValue(v);
              onValue(v);
            }}
          />
        </>
      );
    }
    render(<Host />);
    await user.click(screen.getAllByRole("button", { name: /Callout/ })[0]!);
    await user.click(screen.getByRole("button", { name: "Swap lesson" }));
    const title = screen.getByDisplayValue("Flashcards");
    fireEvent.change(title, { target: { value: "Renamed deck" } });
    const last = onValue.mock.calls.at(-1)![0];
    expect(last.modules).toHaveLength(1);
    expect(last.modules[0].title).toBe("Renamed deck");
  });

  it("applies a late image pick on top of lesson edits made meanwhile", async () => {
    const user = userEvent.setup();
    let pick!: (v: { src: string }) => void;
    const onPickImage = () => new Promise<{ src: string } | null>((r) => (pick = r));
    const onValue = vi.fn();
    function Host() {
      const [value, setValue] = useState<Record<string, unknown>>({
        schemaVersion: 1,
        id: "l",
        title: "Lesson",
        modules: [createExample("hotspot-explorer", { id: "h" })],
      });
      return (
        <LessonEditor
          value={value}
          onPickImage={onPickImage}
          onChange={(v) => {
            setValue(v);
            onValue(v);
          }}
        />
      );
    }
    render(<Host />);
    await user.click(screen.getAllByRole("button", { name: "Choose image" })[0]!);
    await user.click(screen.getByRole("button", { name: "Lesson settings" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "Renamed lesson" },
    });
    await act(async () => pick({ src: "https://example.com/late.png" }));
    const last = onValue.mock.calls.at(-1)![0];
    expect(last.title).toBe("Renamed lesson");
    expect(last.modules[0].content.image.src).toBe("https://example.com/late.png");
  });

  it("editor roots follow the provider's theme and accent", () => {
    const { container } = render(
      <NibblearnProvider theme="dark" accent="#c2410c">
        <ModuleEditor
          value={createExample("callout") as Record<string, unknown>}
          onChange={() => {}}
        />
      </NibblearnProvider>,
    );
    const root = container.querySelector<HTMLElement>(".nbe-root")!;
    expect(root.getAttribute("data-nb-theme")).toBe("dark");
    expect(root.style.getPropertyValue("--nb-accent")).toBe("#c2410c");
  });

  it("shows list-level problems next to the list and keeps focus after removing", async () => {
    const user = userEvent.setup();
    const schema = {
      type: "object",
      properties: {
        tags: { type: "array", title: "Tags", items: { type: "string" }, minItems: 0 },
      },
    };
    const issues = [{ path: "tags", segments: ["tags"], message: "Add at least two tags" }];
    function Host() {
      const [value, setValue] = useState<Record<string, unknown>>({ tags: ["a"] });
      return <ModuleForm value={value} schema={schema} issues={issues} onChange={setValue} />;
    }
    render(<Host />);
    const listError = screen.getAllByText("Add at least two tags").find((e) => e.tagName === "P");
    expect(listError).toBeDefined();
    await user.click(screen.getByRole("button", { name: /tags: Add at least two tags/ }));
    expect(listError).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /^Delete/ }));
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.textContent).toMatch(/Add/);
  });

  it("shows lesson-level problems in settings and marks blocks with duplicate ids", async () => {
    const user = userEvent.setup();
    const modules = [
      createEmpty("callout", { id: "same" }),
      createEmpty("callout", { id: "same" }),
    ];
    const view = render(
      <LessonEditor
        value={{ schemaVersion: 1, id: "l", title: "Lesson", modules }}
        onChange={() => {}}
      />,
    );
    // The second block (the duplicate id) is marked in the list and explained above its form.
    expect(document.querySelectorAll(".nbe-lesson__issue")).toHaveLength(1);
    await user.click(screen.getAllByRole("button", { name: /Block 2 of 2/ })[0]!);
    expect(screen.getByText(/duplicate module id/)).toBeInTheDocument();
    view.unmount();

    render(
      <LessonEditor
        value={{ schemaVersion: 1, id: "l", title: "", modules }}
        onChange={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Lesson settings" }));
    expect(screen.getByRole("textbox", { name: /Title/ })).toHaveAttribute("aria-invalid", "true");
  });
});

describe("fields the author does not need", () => {
  const groups = () =>
    [...document.querySelectorAll(".nbe-section__title")].map((el) => el.textContent?.trim());

  it.each(["callout", "accordion", "tabs", "carousel", "columns"] as const)(
    "%s: content blocks have no feedback or scoring settings",
    (type) => {
      render(
        <ModuleForm value={createExample(type) as Record<string, unknown>} onChange={() => {}} />,
      );
      expect(groups()).not.toContain("Feedback");
      expect(screen.queryByText(/^Weight/)).toBeNull();
      expect(screen.queryByText(/^Pass threshold/)).toBeNull();
    },
  );

  it("activities keep feedback and scoring", () => {
    render(
      <ModuleForm
        value={createExample("choice-challenge") as Record<string, unknown>}
        onChange={() => {}}
      />,
    );
    expect(groups()).toContain("Feedback");
    expect(screen.getAllByText(/^Pass threshold/).length).toBeGreaterThan(0);
  });

  it("hideIds removes every id field and new items still get an id", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    function Host() {
      const [value, setValue] = useState(createExample("accordion") as Record<string, unknown>);
      return (
        <ModuleForm
          value={value}
          hideIds
          onChange={(v) => {
            setValue(v);
            onValue(v);
          }}
        />
      );
    }
    render(<Host />);
    expect(screen.queryByLabelText(/^ID/)).toBeNull();
    // With feedback, scoring and the id gone, nothing is left for an "Advanced" section.
    expect(groups()).not.toContain("Advanced");
    expect(document.querySelector(".nbe-advanced")).toBeNull();

    await user.click(screen.getByRole("button", { name: /add item/i }));
    const items = (onValue.mock.calls.at(-1)![0] as { content: { items: { id: string }[] } })
      .content.items;
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(items.at(-1)!.id).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(validateModule(onValue.mock.calls.at(-1)![0]).success).toBe(true);
  });

  it("hideFields hides fields by path, with * for list items", () => {
    const example = createExample("accordion") as Record<string, unknown>;
    const { unmount } = render(<ModuleForm value={example} onChange={() => {}} />);
    expect(groups()).toContain("Appearance");
    expect(screen.getAllByRole("button", { name: "Add image" }).length).toBeGreaterThan(0);
    unmount();

    render(
      <ModuleForm
        value={example}
        onChange={() => {}}
        hideFields={["appearance", "content.items.*.image"]}
      />,
    );
    expect(groups()).not.toContain("Appearance");
    expect(screen.queryByRole("button", { name: "Add image" })).toBeNull();
    // Untouched fields are still there.
    expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
  });
});
