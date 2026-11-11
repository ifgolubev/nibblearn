import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategorySort } from "./CategorySort";
import { categorySortSchema } from "@nibblearn/core";

const config = categorySortSchema.parse({
  id: "c",
  type: "category-sort",
  title: "Who does what",
  content: {
    categories: [
      { id: "strategy", label: "Strategy", description: "Plans and positioning", color: "accent" },
      { id: "analytics", label: "Analytics", color: "#0ea5e9" },
    ],
    items: [
      {
        id: "i1",
        text: "Write the brief",
        categoryId: "strategy",
        explanation: "Briefs are a strategy deliverable.",
      },
      {
        id: "i2",
        text: "Build the dashboard",
        categoryId: "analytics",
        explanation: "Dashboards live in analytics.",
      },
      { id: "i3", text: "Define positioning", categoryId: "strategy" },
    ],
    hint: "Dashboards are about numbers.",
  },
  behavior: { shuffle: false },
});

const pool = () => screen.getByRole("region", { name: "Unsorted" });
const zone = (name: string) => screen.getByRole("region", { name });
const chip = (name: string) => screen.getByRole("button", { name });

async function placeAll(user: ReturnType<typeof userEvent.setup>, map: Record<string, string>) {
  for (const [item, category] of Object.entries(map)) {
    await user.click(chip(item));
    await user.click(within(zone(category)).getByRole("button", { name: `Place in ${category}` }));
  }
}

describe("CategorySort", () => {
  it("places items by tap, checks and completes with full credit", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<CategorySort config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("heading", { name: "Who does what" })).toBeInTheDocument();
    expect(within(pool()).getAllByRole("button")).toHaveLength(3);
    expect(screen.getAllByText("3 items left to sort").length).toBeGreaterThan(0);
    const check = screen.getByRole("button", { name: "Check" });
    expect(check).toBeDisabled();

    // Select, then place via the zone's action.
    await user.click(chip("Write the brief"));
    expect(chip("Write the brief")).toHaveAttribute("data-state", "selected");
    expect(chip("Write the brief")).toHaveAttribute("aria-pressed", "true");
    await user.click(within(zone("Strategy")).getByRole("button", { name: "Place in Strategy" }));
    expect(
      within(zone("Strategy")).getByRole("button", { name: "Write the brief" }),
    ).toBeInTheDocument();
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:interact");

    // Move it back to the pool and place it again.
    await user.click(
      within(zone("Strategy")).getByRole("button", {
        name: "Remove from category: Write the brief",
      }),
    );
    expect(within(pool()).getByRole("button", { name: "Write the brief" })).toBeInTheDocument();

    await placeAll(user, {
      "Write the brief": "Strategy",
      "Build the dashboard": "Analytics",
      "Define positioning": "Strategy",
    });
    expect(screen.getByRole("button", { name: "Check" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Everything sorted correctly!")).toBeInTheDocument();
    expect(chip("Write the brief")).toHaveAttribute("data-state", "correct");
    expect(screen.getByText("Briefs are a strategy deliverable.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0]![0];
    expect(result.score).toBe(1);
    expect(result.correct).toBe(3);
    expect(result.total).toBe(3);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("marks wrong items, locks correct ones on retry and decays the score", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<CategorySort config={config} onComplete={onComplete} />);

    await placeAll(user, {
      "Write the brief": "Analytics",
      "Build the dashboard": "Analytics",
      "Define positioning": "Strategy",
    });
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Not quite")).toBeInTheDocument();
    expect(chip("Write the brief")).toHaveAttribute("data-state", "incorrect");
    expect(screen.getByText("Belongs in Strategy")).toBeInTheDocument();
    expect(screen.getByText("Briefs are a strategy deliverable.")).toBeInTheDocument();
    expect(chip("Build the dashboard")).toHaveAttribute("data-state", "correct");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByText("Not quite")).not.toBeInTheDocument());
    // Incorrect item returned to the pool, correct ones locked in place.
    expect(within(pool()).getByRole("button", { name: "Write the brief" })).toBeInTheDocument();
    expect(chip("Build the dashboard")).toHaveAttribute("data-state", "locked");
    expect(chip("Build the dashboard")).toHaveAttribute("aria-disabled", "true");

    await placeAll(user, { "Write the brief": "Strategy" });
    await user.click(screen.getByRole("button", { name: "Check" }));
    await user.click(await screen.findByRole("button", { name: "Finish" }));
    expect(onComplete.mock.calls[0]![0].score).toBe(0.75);
  });

  it("reveals the answer after the second failed attempt", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<CategorySort config={config} onComplete={onComplete} />);
    await placeAll(user, {
      "Write the brief": "Analytics",
      "Build the dashboard": "Strategy",
      "Define positioning": "Strategy",
    });
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.queryByRole("button", { name: "Show answer" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    await placeAll(user, { "Write the brief": "Analytics", "Build the dashboard": "Strategy" });
    await user.click(screen.getByRole("button", { name: "Check" }));
    await user.click(await screen.findByRole("button", { name: "Show answer" }));
    // Everything moved to the right place.
    expect(
      within(zone("Strategy")).getByRole("button", { name: "Write the brief" }),
    ).toBeInTheDocument();
    expect(
      within(zone("Analytics")).getByRole("button", { name: "Build the dashboard" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(onComplete.mock.calls[0]![0].score).toBeCloseTo(1 / 3);
    expect(onComplete.mock.calls[0]![0].details.revealed).toBe(true);
  });

  it("is operable with the keyboard", async () => {
    const user = userEvent.setup();
    render(<CategorySort config={config} />);
    chip("Build the dashboard").focus();
    await user.keyboard("{Enter}");
    expect(chip("Build the dashboard")).toHaveAttribute("data-state", "selected");
    within(zone("Analytics")).getByRole("button", { name: "Place in Analytics" }).focus();
    await user.keyboard(" ");
    expect(
      within(zone("Analytics")).getByRole("button", { name: "Build the dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("2 items left to sort").length).toBeGreaterThan(0);
  });

  it("renders an error state for invalid config", () => {
    render(
      <CategorySort
        config={
          {
            id: "x",
            type: "category-sort",
            content: {
              categories: [
                { id: "a", label: "A" },
                { id: "b", label: "B" },
              ],
              items: [{ id: "i", text: "t", categoryId: "zzz" }],
            },
          } as never
        }
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CategorySort config={config} resetKey={1} />);
    await placeAll(user, { "Write the brief": "Strategy" });
    expect(
      within(zone("Strategy")).getByRole("button", { name: "Write the brief" }),
    ).toBeInTheDocument();
    rerender(<CategorySort config={config} resetKey={2} />);
    await waitFor(() =>
      expect(within(pool()).getByRole("button", { name: "Write the brief" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
  });
});
