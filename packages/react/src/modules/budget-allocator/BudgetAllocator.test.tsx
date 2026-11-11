import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  allocationScore,
  budgetAllocatorSchema,
  evaluateAllocation,
  formatValue,
  optimalAllocation,
} from "@nibblearn/core";
import { BudgetAllocator } from "./BudgetAllocator";

const base = {
  id: "plan",
  type: "budget-allocator",
  title: "Spring plan",
  instructions: "Split the budget.",
  content: {
    totalBudget: 100000,
    kpiLabel: "Leads",
    channels: [
      {
        id: "search",
        label: "Search",
        description: "High intent.",
        efficiency: 100,
        saturation: 0.5,
      },
      { id: "video", label: "Video", efficiency: 20, saturation: 1, color: "violet" },
      { id: "social", label: "Social", efficiency: 50, saturation: 0.7, max: 50, color: "#ff8800" },
    ],
    initial: { search: 40, video: 30, social: 30 },
    goal: { description: "Reach **1,950 leads**.", minKpi: 1950 },
    explanation: "Fund the highest marginal return.",
  },
  behavior: { step: 10 },
} as const;

const config = budgetAllocatorSchema.parse(base);
const kpiText = (shares: Record<string, number>) =>
  formatValue(evaluateAllocation(config, shares).totalKpi, "integer");

function slider(name: string) {
  return screen.getByRole("slider", { name });
}
function shareSum() {
  return screen
    .getAllByRole("slider")
    .reduce((s, el) => s + Number((el as HTMLInputElement).value), 0);
}

describe("BudgetAllocator", () => {
  it("renders stats, channel sliders, the allocation table and the goal", () => {
    render(<BudgetAllocator config={config} />);
    expect(screen.getByRole("heading", { name: "Spring plan" })).toBeInTheDocument();
    expect(screen.getAllByRole("slider")).toHaveLength(3);
    expect(slider("Search")).toHaveAttribute("aria-valuetext", "40% · $40,000");
    expect(slider("Search")).toHaveAccessibleDescription("High intent.");
    expect(screen.getByText("$100,000")).toBeInTheDocument();
    expect(screen.getAllByText(kpiText(config.content.initial)).length).toBeGreaterThan(0);
    const table = screen.getByRole("table", { name: "Allocation" });
    expect(within(table).getByRole("row", { name: /Video 30% \$30,000/ })).toBeInTheDocument();
    expect(screen.getByText("Max 50%")).toBeInTheDocument();
    expect(screen.getByText("Not yet — keep rebalancing.")).toBeInTheDocument();
    expect(screen.getByText("Figures are illustrative.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset split" })).toBeDisabled();
  });

  it("rebalances the other channels so the total stays at 100% and emits interactions", async () => {
    const onEvent = vi.fn();
    render(<BudgetAllocator config={config} onEvent={onEvent} />);
    fireEvent.change(slider("Search"), { target: { value: "60" } });
    expect(slider("Search")).toHaveValue("60");
    expect(shareSum()).toBe(100);
    expect(slider("Video")).toHaveValue("20");
    expect(slider("Social")).toHaveValue("20");
    const shares = { search: 60, video: 20, social: 20 };
    expect(screen.getAllByText(kpiText(shares)).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:interact"),
    );
    const interact = onEvent.mock.calls.find((c) => c[0].type === "module:interact")![0];
    expect(interact.payload.shares).toEqual(shares);
  });

  it("steps with the +/- buttons and keyboard, respecting channel maximums", async () => {
    const user = userEvent.setup();
    render(<BudgetAllocator config={config} />);
    await user.click(screen.getByRole("button", { name: "Increase Social" }));
    expect(slider("Social")).toHaveValue("40");
    screen.getByRole("button", { name: "Increase Social" }).focus();
    await user.keyboard("{Enter}");
    expect(slider("Social")).toHaveValue("50");
    expect(screen.getByRole("button", { name: "Increase Social" })).toBeDisabled();
    expect(shareSum()).toBe(100);
    // Dragging past the max clamps to it.
    fireEvent.change(slider("Social"), { target: { value: "90" } });
    expect(slider("Social")).toHaveValue("50");
    await user.click(screen.getByRole("button", { name: "Decrease Social" }));
    expect(slider("Social")).toHaveValue("40");
    expect(shareSum()).toBe(100);
  });

  it("locks channels so rebalancing leaves them alone", async () => {
    const user = userEvent.setup();
    render(<BudgetAllocator config={config} />);
    const lockVideo = screen.getByRole("button", { name: "Lock Video" });
    expect(lockVideo).toHaveAttribute("aria-pressed", "false");
    await user.click(lockVideo);
    expect(lockVideo).toHaveAttribute("aria-pressed", "true");
    expect(slider("Video")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Increase Video" })).toBeDisabled();
    // Only two channels remain unlocked: locking another would freeze everything.
    expect(screen.getByRole("button", { name: "Lock Search" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Increase Search" }));
    expect(slider("Search")).toHaveValue("50");
    expect(slider("Video")).toHaveValue("30");
    expect(slider("Social")).toHaveValue("20");

    // Reset restores the starting split and clears locks.
    await user.click(screen.getByRole("button", { name: "Reset split" }));
    expect(slider("Search")).toHaveValue("40");
    expect(lockVideo).toHaveAttribute("aria-pressed", "false");
  });

  it("announces the goal, locks in the plan and reveals the optimum", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<BudgetAllocator config={config} onComplete={onComplete} onEvent={onEvent} />);

    const optimal = optimalAllocation(config);
    // Move to the optimal split: set video, lock it, then set search (social absorbs the rest).
    fireEvent.change(slider("Video"), { target: { value: String(optimal.video) } });
    await user.click(screen.getByRole("button", { name: "Lock Video" }));
    fireEvent.change(slider("Search"), { target: { value: String(optimal.search) } });
    expect(slider("Social")).toHaveValue(String(optimal.social));
    expect(await screen.findAllByText("Goal reached!")).not.toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Lock in plan" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0]![0];
    expect(result.score).toBe(1);
    expect(result.details.shares).toEqual(optimal);
    expect(result.details.goalMet).toBe(true);
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:answer");

    expect(await screen.findByRole("heading", { name: "Results" })).toHaveFocus();
    expect(screen.getByText("Optimal plan", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("100% of optimal")).toBeInTheDocument();
    expect(screen.getByText("You matched the optimal plan.")).toBeInTheDocument();
    expect(screen.getByText("Fund the highest marginal return.")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /compared with the optimal/ })).toBeInTheDocument();
    for (const s of screen.getAllByRole("slider")) expect(s).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Lock in plan" })).not.toBeInTheDocument();
  });

  it("scores a sub-optimal plan against the optimum and retries", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<BudgetAllocator config={config} onComplete={onComplete} onEvent={onEvent} />);
    await user.click(screen.getByRole("button", { name: "Lock in plan" }));
    const learner = evaluateAllocation(config, config.content.initial).totalKpi;
    const best = evaluateAllocation(config, optimalAllocation(config)).totalKpi;
    const expected = allocationScore(learner, best);
    expect(onComplete.mock.calls[0]![0].score).toBeCloseTo(expected, 9);
    expect(expected).toBeLessThan(1);
    expect(screen.getByText(`${Math.round(expected * 100)}% of optimal`)).toBeInTheDocument();
    expect(screen.getByText(/Gap to optimal/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByText("Results")).not.toBeInTheDocument());
    expect(slider("Search")).toBeEnabled();
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:reset");
  });

  it("hides the optimum and scores by goal progress when configured", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const cfg = budgetAllocatorSchema.parse({
      ...base,
      behavior: { step: 10, showOptimal: false, scoreAgainstOptimal: false, allowLock: false },
    });
    render(<BudgetAllocator config={cfg} onComplete={onComplete} />);
    expect(
      screen.queryByRole("button", { name: /^Lock (Search|Video|Social)/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lock in plan" }));
    const kpi = evaluateAllocation(cfg, cfg.content.initial).totalKpi;
    expect(onComplete.mock.calls[0]![0].score).toBeCloseTo(Math.min(1, kpi / 1950), 9);
    expect(screen.queryByText("Optimal plan", { selector: "span" })).not.toBeInTheDocument();
    expect(screen.getByText("Your plan")).toBeInTheDocument();
  });

  it("resets when resetKey changes", async () => {
    const { rerender } = render(<BudgetAllocator config={config} resetKey={1} />);
    fireEvent.change(slider("Search"), { target: { value: "70" } });
    expect(slider("Search")).toHaveValue("70");
    rerender(<BudgetAllocator config={config} resetKey={2} />);
    await waitFor(() => expect(slider("Search")).toHaveValue("40"));
  });

  it("renders an error state for invalid config", () => {
    render(
      <BudgetAllocator
        config={
          {
            ...base,
            content: { ...base.content, initial: { search: 50, video: 30, social: 30 } },
          } as never
        }
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/sum to 100/);
  });
});
