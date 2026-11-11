import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { priorityMatrixSchema } from "@nibblearn/core";
import { PriorityMatrix } from "./PriorityMatrix";

const config = priorityMatrixSchema.parse({
  id: "pm",
  type: "priority-matrix",
  title: "Monday triage",
  content: {
    axes: {
      x: { label: "Urgency", low: "low", high: "high" },
      y: { label: "Importance", low: "low", high: "high" },
    },
    quadrants: [
      { id: "do", position: "top-right", label: "Do now", color: "pink" },
      { id: "schedule", position: "top-left", label: "Schedule", description: "Book time" },
      { id: "delegate", position: "bottom-right", label: "Delegate", color: "sky" },
      { id: "drop", position: "bottom-left", label: "Drop", color: "#888888" },
    ],
    items: [
      { id: "a", text: "Fix tracking", quadrantId: "do", explanation: "Live spend is at risk." },
      { id: "b", text: "Plan Q3", quadrantId: "schedule" },
      { id: "c", text: "Weekly export", quadrantId: "delegate" },
      { id: "d", text: "Tidy archive", quadrantId: "drop" },
    ],
    explanation: "Urgency is the clock; importance is the client.",
  },
  behavior: { shuffle: false },
});

const tray = () => screen.getByRole("region", { name: "To place" });
const quadrant = (name: string) => screen.getByRole("region", { name });
const chip = (name: string) => screen.getByRole("button", { name });

async function placeAll(user: ReturnType<typeof userEvent.setup>, map: Record<string, string>) {
  for (const [item, q] of Object.entries(map)) {
    await user.click(chip(item));
    await user.click(within(quadrant(q)).getByRole("button", { name: `Place in ${q}` }));
  }
}

const correct = {
  "Fix tracking": "Do now",
  "Plan Q3": "Schedule",
  "Weekly export": "Delegate",
  "Tidy archive": "Drop",
};

describe("PriorityMatrix", () => {
  it("renders a 2×2 with axes, places by tap and completes with full credit", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<PriorityMatrix config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("group", { name: "Importance by Urgency matrix" })).toBeInTheDocument();
    // Reading order: top-left, top-right, bottom-left, bottom-right.
    const labels = screen
      .getAllByRole("region")
      .map((r) => r.getAttribute("aria-label"))
      .filter((l) => l && l !== "To place");
    expect(labels).toEqual(["Schedule", "Do now", "Drop", "Delegate"]);
    expect(quadrant("Do now")).toHaveAccessibleDescription("Importance: high. Urgency: high.");
    expect(screen.getByText("0 of 4 placed")).toBeInTheDocument();
    const check = screen.getByRole("button", { name: "Check" });
    expect(check).toBeDisabled();

    await user.click(chip("Fix tracking"));
    expect(chip("Fix tracking")).toHaveAttribute("aria-pressed", "true");
    await user.click(within(quadrant("Do now")).getByRole("button", { name: "Place in Do now" }));
    expect(
      within(quadrant("Do now")).getByRole("button", { name: "Fix tracking" }),
    ).toBeInTheDocument();

    // Move it back to the tray via selection.
    await user.click(chip("Fix tracking"));
    await user.click(within(tray()).getByRole("button", { name: "Return to tray" }));
    expect(within(tray()).getByRole("button", { name: "Fix tracking" })).toBeInTheDocument();

    await placeAll(user, correct);
    expect(check).toBeEnabled();
    await user.click(check);
    expect(await screen.findAllByText("Every task is in the right quadrant!")).not.toHaveLength(0);
    expect(screen.getByText("Urgency is the clock; importance is the client.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const result = onComplete.mock.calls[0]![0];
    expect(result.score).toBe(1);
    expect(result.correct).toBe(4);
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:answer");
    expect(screen.getByRole("group", { name: "Expert placement" })).toHaveTextContent("Plan Q3");
  });

  it("explains wrong placements, locks correct ones on retry, then reveals", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<PriorityMatrix config={config} onComplete={onComplete} />);
    await placeAll(user, { ...correct, "Fix tracking": "Schedule", "Plan Q3": "Do now" });
    await user.click(screen.getByRole("button", { name: "Check" }));

    // In-cell note (wide) and review list (narrow); CSS shows one of them per container width.
    expect(within(quadrant("Schedule")).getByText("Belongs in Do now")).toBeInTheDocument();
    const review = screen.getByRole("list", { name: "Review" });
    expect(within(review).getByText("Live spend is at risk.")).toBeInTheDocument();
    expect(within(review).getByRole("img", { name: "Not quite" })).toBeInTheDocument();
    expect(chip("Fix tracking")).toHaveAttribute("data-state", "incorrect");
    expect(chip("Weekly export")).toHaveAttribute("data-state", "correct");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(within(tray()).getAllByRole("button")).toHaveLength(2);
    expect(chip("Weekly export")).toHaveAttribute("data-state", "locked");
    expect(chip("Weekly export")).toHaveAttribute("aria-disabled", "true");

    await placeAll(user, { "Fix tracking": "Delegate", "Plan Q3": "Drop" });
    await user.click(screen.getByRole("button", { name: "Check" }));
    await user.click(await screen.findByRole("button", { name: "Show answer" }));
    expect(
      within(quadrant("Do now")).getByRole("button", { name: "Fix tracking" }),
    ).toHaveAttribute("data-state", "revealed");
    await user.click(screen.getByRole("button", { name: "Finish" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onComplete.mock.calls[0]![0].score).toBe(0.5);
  });

  it("is operable with the keyboard alone", async () => {
    const user = userEvent.setup();
    render(<PriorityMatrix config={config} />);
    chip("Plan Q3").focus();
    await user.keyboard("{Enter}");
    const place = within(quadrant("Schedule")).getByRole("button", { name: "Place in Schedule" });
    place.focus();
    await user.keyboard("{Enter}");
    expect(
      within(quadrant("Schedule")).getByRole("button", { name: "Plan Q3" }),
    ).toBeInTheDocument();
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PriorityMatrix config={config} resetKey={1} />);
    await placeAll(user, { "Plan Q3": "Schedule" });
    expect(screen.getByText("1 of 4 placed")).toBeInTheDocument();
    rerender(<PriorityMatrix config={config} resetKey={2} />);
    await waitFor(() => expect(screen.getByText("0 of 4 placed")).toBeInTheDocument());
  });

  it("renders an alert for invalid config", () => {
    render(
      <PriorityMatrix
        config={
          {
            ...config,
            content: { ...config.content, quadrants: config.content.quadrants.slice(0, 3) },
          } as never
        }
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
