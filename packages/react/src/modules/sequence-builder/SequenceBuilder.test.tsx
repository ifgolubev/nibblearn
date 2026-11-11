import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SequenceBuilder } from "./SequenceBuilder";
import { sequenceBuilderSchema } from "@nibblearn/core";

const config = sequenceBuilderSchema.parse({
  id: "s",
  type: "sequence-builder",
  title: "Launch order",
  content: {
    items: [
      { id: "brief", text: "Brief", description: "Everything starts with the brief." },
      { id: "plan", text: "Plan" },
      { id: "launch", text: "Launch" },
    ],
    explanation: "Brief, then plan, then launch.",
    hint: "The brief always comes first.",
  },
  behavior: { shuffleSeed: 3 },
});

const rows = () =>
  within(screen.getByRole("list", { name: "Launch order" })).getAllByRole("listitem");
const rowTexts = () => rows().map((r) => r.querySelector(".nb-seq__text")?.textContent);

async function putInOrder(user: ReturnType<typeof userEvent.setup>, target: string[]) {
  for (let i = 0; i < target.length; i++) {
    let current = rowTexts().indexOf(target[i]!);
    while (current > i) {
      await user.click(screen.getByRole("button", { name: `Move up: ${target[i]}` }));
      current--;
    }
  }
}

describe("SequenceBuilder", () => {
  it("renders shuffled, reorders with buttons, checks and completes", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<SequenceBuilder config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("heading", { name: "Launch order" })).toBeInTheDocument();
    expect(rows()).toHaveLength(3);
    expect(rowTexts()).not.toEqual(["Brief", "Plan", "Launch"]);
    // Ends are disabled.
    expect(screen.getByRole("button", { name: `Move up: ${rowTexts()[0]}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Move down: ${rowTexts()[2]}` })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Show hint" }));
    expect(screen.getByText("The brief always comes first.")).toBeInTheDocument();
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:hint");

    await putInOrder(user, ["Brief", "Plan", "Launch"]);
    expect(rowTexts()).toEqual(["Brief", "Plan", "Launch"]);
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Perfect order!")).toBeInTheDocument();
    expect(rows().every((r) => r.getAttribute("data-state") === "correct")).toBe(true);
    expect(screen.getByText("Brief, then plan, then launch.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0]![0];
    expect(result.score).toBe(1);
    expect(result.correct).toBe(3);
    expect(result.total).toBe(3);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("marks wrong positions, allows retry and reveals the solution after the second attempt", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<SequenceBuilder config={config} onComplete={onComplete} />);

    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Not quite")).toBeInTheDocument();
    expect(rows().some((r) => r.getAttribute("data-state") === "incorrect")).toBe(true);
    expect(screen.queryByRole("button", { name: "Show correct order" })).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole("button", { name: /Move up/ })
        .every((b) => (b as HTMLButtonElement).disabled),
    ).toBe(true);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByText("Not quite")).not.toBeInTheDocument());
    expect(rows().every((r) => r.getAttribute("data-state") === "idle")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Check" }));
    await user.click(await screen.findByRole("button", { name: "Show correct order" }));
    const solution = await screen.findByRole("region", { name: "Correct order" });
    expect(
      within(solution)
        .getAllByRole("listitem")
        .map((li) => li.querySelector(".nb-seq__solution-text")?.textContent),
    ).toEqual(["Brief", "Plan", "Launch"]);
    expect(within(solution).getByText("Everything starts with the brief.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish" }));

    const result = onComplete.mock.calls[0]![0];
    expect(result.score).toBeLessThanOrEqual(0.5);
    expect(result.details.revealed).toBe(true);
  });

  it("gives reduced credit when correct on a later attempt", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<SequenceBuilder config={config} onComplete={onComplete} />);
    await user.click(screen.getByRole("button", { name: "Check" }));
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    await putInOrder(user, ["Brief", "Plan", "Launch"]);
    await user.click(screen.getByRole("button", { name: "Check" }));
    await user.click(await screen.findByRole("button", { name: "Finish" }));
    expect(onComplete.mock.calls[0]![0].score).toBe(0.75);
  });

  it("supports keyboard operation of the move buttons", async () => {
    const user = userEvent.setup();
    render(<SequenceBuilder config={config} />);
    const first = rowTexts()[1]!;
    screen.getByRole("button", { name: `Move up: ${first}` }).focus();
    await user.keyboard("{Enter}");
    expect(rowTexts()[0]).toBe(first);
    expect(
      screen.getByRole("button", { name: "Brief", description: /Press Space or Enter to pick up/ }),
    ).toBeInTheDocument();
  });

  it("renders an error state for invalid config", () => {
    render(
      <SequenceBuilder
        config={{ id: "x", type: "sequence-builder", content: { items: [] } } as never}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SequenceBuilder config={config} resetKey={1} />);
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Not quite")).toBeInTheDocument();
    rerender(<SequenceBuilder config={config} resetKey={2} />);
    await waitFor(() => expect(screen.queryByText("Not quite")).not.toBeInTheDocument());
    expect(await screen.findByRole("button", { name: "Check" })).toBeEnabled();
  });
});
