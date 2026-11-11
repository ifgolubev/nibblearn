import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { imageCompareSchema } from "@nibblearn/core";
import { ImageCompare } from "./ImageCompare";

const base = {
  id: "cmp",
  type: "image-compare" as const,
  title: "Before and after",
  content: {
    before: { image: { src: "b.svg", alt: "Old page", width: 1200, height: 800 } },
    after: { image: { src: "a.svg", alt: "New page", width: 1200, height: 800 } },
    annotations: [
      { id: "n1", x: 20, y: 30, side: "before" as const, title: "Busy hero", text: "Too much." },
      {
        id: "n2",
        x: 80,
        y: 60,
        side: "after" as const,
        title: "Clear form",
        text: "Three fields.",
      },
    ],
    question: {
      prompt: "Which change mattered most?",
      options: [
        { text: "Shorter form", correct: true, explanation: "Less effort." },
        { text: "New colours", explanation: "Cosmetic." },
        { text: "Bigger logo" },
      ],
      explanation: "Test one change at a time.",
    },
    takeaway: "Remove friction first.",
  },
};
const config = imageCompareSchema.parse(base);

const marker = (i: number) =>
  document.querySelectorAll<HTMLButtonElement>(".nb-cmp__marker")[i] as HTMLButtonElement;
const noteButton = (name: RegExp) =>
  within(screen.getByRole("region", { name: "What changed" })).getByRole("button", { name });
const slider = () => screen.getByRole("slider", { name: "Compare Before and After" });

describe("ImageCompare", () => {
  it("explores with the keyboard slider, answers the question and completes", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<ImageCompare config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("heading", { name: "Before and after" })).toBeInTheDocument();
    expect(slider()).toHaveAttribute("aria-valuenow", "50");
    expect(slider()).toHaveAttribute("aria-valuetext", "50% Before");
    expect(screen.queryByText("Which change mattered most?")).not.toBeInTheDocument();

    slider().focus();
    await user.keyboard("{ArrowRight}");
    expect(slider()).toHaveAttribute("aria-valuenow", "55");
    await user.keyboard("{PageUp}");
    expect(slider()).toHaveAttribute("aria-valuenow", "75");
    await user.keyboard("{End}");
    expect(slider()).toHaveAttribute("aria-valuetext", "100% Before");
    expect(screen.getByText("Before seen in full")).toBeInTheDocument();
    // The "after" note is hidden while the before image covers it.
    expect(marker(1)).toHaveAttribute("data-visible", "false");
    expect(marker(1)).toHaveAttribute("aria-label", "Note 2: Clear form");
    await user.keyboard("{Home}");
    expect(slider()).toHaveAttribute("aria-valuenow", "0");
    expect(await screen.findByText("Which change mattered most?")).toBeInTheDocument();
    expect(screen.getByText("You've explored both versions.")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /New colours/ }));
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Cosmetic.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("radio", { name: /New colours/ })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Shorter form/ }));
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Less effort.")).toBeInTheDocument();
    expect(screen.getByText("Test one change at a time.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0]).toMatchObject({ score: 0.75, correct: 0, total: 1 });
    expect(screen.getByText("Remove friction first.")).toBeInTheDocument();
    const types = onEvent.mock.calls.map((c) => c[0].type);
    expect(types).toContain("module:answer");
    expect(types).toContain("module:interact");
    expect(screen.getByRole("button", { name: "Restart" })).toBeInTheDocument();
  });

  it("opening every note also counts as explored and moves the divider to reveal it", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const noQuestion = imageCompareSchema.parse({
      ...base,
      content: { ...base.content, question: undefined },
    });
    render(<ImageCompare config={noQuestion} onComplete={onComplete} />);

    await user.click(noteButton(/Busy hero/));
    expect(screen.getByRole("group", { name: "Busy hero" })).toHaveTextContent("Too much.");
    expect(
      screen.getByText("1 of 2 notes opened", { selector: ".nb-counter" }),
    ).toBeInTheDocument();
    expect(slider()).toHaveAttribute("aria-valuenow", "50");

    await user.click(noteButton(/Clear form/));
    // Revealing the "after" note at x=80 does not need to move; it is already visible.
    expect(screen.getByRole("group", { name: "Clear form" })).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0].score).toBeUndefined();
    expect(await screen.findByText("Remove friction first.")).toBeInTheDocument();
  });

  it("reveals a hidden note by moving the divider", async () => {
    const user = userEvent.setup();
    const cfg = imageCompareSchema.parse({
      ...base,
      content: {
        ...base.content,
        annotations: [
          { id: "far", x: 90, y: 50, side: "before", title: "Long form", text: "Nine fields." },
        ],
      },
    });
    render(<ImageCompare config={cfg} />);
    expect(marker(0)).toHaveAttribute("data-visible", "false");
    expect(marker(0)).toHaveAttribute("tabindex", "-1");
    await user.click(noteButton(/Long form/));
    expect(slider()).toHaveAttribute("aria-valuenow", "100");
    expect(marker(0)).toHaveAttribute("data-visible", "true");
    expect(marker(0)).toHaveAccessibleName("Note 1: Long form");
    await user.keyboard("{Escape}");
  });

  it("drags the divider with the pointer", () => {
    render(<ImageCompare config={config} />);
    const stage = slider().closest(".nb-cmp__stage") as HTMLElement;
    stage.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 400,
        height: 300,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
      }) as DOMRect;
    fireEvent.pointerDown(stage, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 100 });
    expect(slider()).toHaveAttribute("aria-valuenow", "25");
    fireEvent.pointerMove(stage, { pointerId: 1, pointerType: "mouse", clientX: 300 });
    expect(slider()).toHaveAttribute("aria-valuenow", "75");
    fireEvent.pointerUp(stage, { pointerId: 1, pointerType: "mouse", clientX: 300 });
    // Touch: a vertical move is left to the browser (scroll), a horizontal one drags.
    fireEvent.pointerDown(stage, { pointerId: 2, pointerType: "touch", clientX: 300, clientY: 10 });
    fireEvent.pointerMove(stage, { pointerId: 2, pointerType: "touch", clientX: 302, clientY: 80 });
    expect(slider()).toHaveAttribute("aria-valuenow", "75");
    fireEvent.pointerMove(stage, { pointerId: 2, pointerType: "touch", clientX: 40, clientY: 82 });
    expect(slider()).toHaveAttribute("aria-valuenow", "10");
    fireEvent.pointerUp(stage, { pointerId: 2, pointerType: "touch", clientX: 40 });
  });

  it("renders an error state for invalid config", () => {
    render(
      <ImageCompare
        config={
          {
            ...base,
            content: {
              ...base.content,
              question: { prompt: "?", options: [{ text: "a" }, { text: "b" }] },
            },
          } as never
        }
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ImageCompare config={config} resetKey={1} />);
    slider().focus();
    await user.keyboard("{End}");
    expect(slider()).toHaveAttribute("aria-valuenow", "100");
    rerender(<ImageCompare config={config} resetKey={2} />);
    await waitFor(() => expect(slider()).toHaveAttribute("aria-valuenow", "50"));
  });
});
