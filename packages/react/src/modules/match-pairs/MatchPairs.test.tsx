import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatchPairs } from "./MatchPairs";
import { matchPairsSchema } from "@nibblearn/core";

const config = matchPairsSchema.parse({
  id: "m",
  type: "match-pairs",
  title: "Metric match",
  content: {
    leftLabel: "Metric",
    rightLabel: "Definition",
    pairs: [
      { left: "CPA", right: "Cost per acquisition", explanation: "Spend divided by conversions." },
      { left: "CTR", right: "Click-through rate" },
      { left: "CPM", right: "Cost per thousand impressions" },
    ],
  },
  behavior: { shuffle: false, pairsPerRound: 2, timer: true },
});

const leftTile = (name: string) =>
  within(screen.getByRole("group", { name: "Metric" })).getByRole("button", { name });
const rightTile = (name: string) =>
  within(screen.getByRole("group", { name: "Definition" })).getByRole("button", { name });

describe("MatchPairs", () => {
  it("matches pairs by tapping, counts mistakes, advances rounds and completes", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<MatchPairs config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("heading", { name: "Metric match" })).toBeInTheDocument();
    expect(screen.getByText("0 of 3 matched")).toBeInTheDocument();
    expect(screen.getByText("00:00")).toBeInTheDocument();
    // Round 1 shows only two pairs.
    expect(leftTile("CPA")).toBeInTheDocument();
    expect(leftTile("CTR")).toBeInTheDocument();
    expect(screen.queryByText("CPM")).not.toBeInTheDocument();

    // Wrong attempt.
    await user.click(leftTile("CPA"));
    expect(leftTile("CPA")).toHaveAttribute("data-state", "selected");
    expect(leftTile("CPA")).toHaveAttribute("aria-pressed", "true");
    await user.click(rightTile("Click-through rate"));
    expect(await screen.findByText("Not a pair. Try again.")).toBeInTheDocument();
    expect(screen.getByText("1 mistakes")).toBeInTheDocument();
    expect(leftTile("CPA")).toHaveAttribute("data-state", "wrong");

    // Correct attempts (right-first also works).
    await user.click(rightTile("Cost per acquisition"));
    await user.click(leftTile("CPA"));
    expect(leftTile("CPA")).toHaveAttribute("data-state", "matched");
    expect(screen.getByText("1 of 3 matched")).toBeInTheDocument();
    await user.click(leftTile("CTR"));
    await user.click(rightTile("Click-through rate"));

    // Round 2 animates in with the remaining pair.
    const cpm = await screen.findByRole("button", { name: "CPM" }, { timeout: 3000 });
    await user.click(cpm);
    await user.click(rightTile("Cost per thousand impressions"));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 3000 });
    const result = onComplete.mock.calls[0]![0];
    expect(result.total).toBe(3);
    expect(result.correct).toBe(3);
    expect(result.score).toBeCloseTo(1 - 1 / 6);
    expect(result.details.mistakes).toBe(1);
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:complete");
    expect(await screen.findByText("All pairs matched!")).toBeInTheDocument();
    expect(screen.getByText("Spend divided by conversions.")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();

    // Retry restarts the activity.
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("0 of 3 matched")).toBeInTheDocument();
  });

  it("works with the keyboard (Tab + Enter/Space)", async () => {
    const user = userEvent.setup();
    render(<MatchPairs config={config} />);
    leftTile("CPA").focus();
    await user.keyboard("{Enter}");
    expect(leftTile("CPA")).toHaveAttribute("data-state", "selected");
    rightTile("Cost per acquisition").focus();
    await user.keyboard(" ");
    expect(leftTile("CPA")).toHaveAttribute("data-state", "matched");
    expect(screen.getByText("1 of 3 matched")).toBeInTheDocument();
  });

  it("toggles selection within the same column", async () => {
    const user = userEvent.setup();
    render(<MatchPairs config={config} />);
    await user.click(leftTile("CPA"));
    await user.click(leftTile("CTR"));
    expect(leftTile("CPA")).toHaveAttribute("data-state", "idle");
    expect(leftTile("CTR")).toHaveAttribute("data-state", "selected");
    await user.click(leftTile("CTR"));
    expect(leftTile("CTR")).toHaveAttribute("data-state", "idle");
  });

  it("renders an error state for invalid config", () => {
    render(
      <MatchPairs config={{ id: "x", type: "match-pairs", content: { pairs: [] } } as never} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MatchPairs config={config} resetKey={1} />);
    await user.click(leftTile("CPA"));
    await user.click(rightTile("Cost per acquisition"));
    expect(screen.getByText("1 of 3 matched")).toBeInTheDocument();
    rerender(<MatchPairs config={config} resetKey={2} />);
    await waitFor(() => expect(screen.getByText("0 of 3 matched")).toBeInTheDocument());
    await waitFor(() => expect(leftTile("CPA")).toHaveAttribute("data-state", "idle"));
  });
});
