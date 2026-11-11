import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Flashcards } from "./Flashcards";
import { flashcardsSchema } from "@nibblearn/core";

const config = flashcardsSchema.parse({
  id: "deck",
  type: "flashcards",
  title: "Metric deck",
  content: {
    cards: [
      {
        front: "CPM",
        back: "Cost per thousand impressions",
        tag: "Cost",
        hint: "Think per mille.",
      },
      { front: "CTR", back: "Clicks divided by impressions", tag: "Rate" },
      { front: "ROAS", back: "Revenue divided by ad spend" },
    ],
  },
});

describe("Flashcards", () => {
  it("flips, rates cards, runs a review round and completes with first-pass score", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<Flashcards config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("heading", { name: "Metric deck" })).toBeInTheDocument();
    expect(screen.getByText("0 mastered")).toBeInTheDocument();
    expect(screen.getByText("3 to review")).toBeInTheDocument();
    expect(screen.getByText("1 of 3")).toBeInTheDocument();

    const card = screen.getByRole("button", { name: /^Flip card/ });
    expect(card).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Got it" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Show hint" })).toBeInTheDocument();

    await user.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Got it" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(await screen.findByText("1 mastered")).toBeInTheDocument();

    // Card 2: practice again.
    await user.click(await screen.findByRole("button", { name: /^Flip card/ }));
    await user.click(screen.getByRole("button", { name: "Practice again" }));
    // Card 3: got it.
    await user.click(await screen.findByRole("button", { name: /^Flip card/ }));
    await user.click(screen.getByRole("button", { name: "Got it" }));

    // Review round interstitial.
    expect(await screen.findByText("Review round")).toBeInTheDocument();
    expect(screen.getByText(/1 cards you marked for practice/)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const review = await screen.findByRole("button", { name: /^Flip card/ });
    expect(screen.getByText("1 of 1")).toBeInTheDocument();
    await user.click(review);
    await user.click(screen.getByRole("button", { name: "Got it" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const result = onComplete.mock.calls[0]![0];
    expect(result.score).toBeCloseTo(2 / 3);
    expect(result.correct).toBe(2);
    expect(result.total).toBe(3);
    expect(result.details).toEqual({ firstPassMastered: 2, rounds: 2, mastered: 3 });
    expect(await screen.findByText("All cards mastered")).toBeInTheDocument();
    expect(screen.getByText("You mastered 2 of 3 cards on the first pass.")).toBeInTheDocument();
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:answer");
    await user.click(screen.getByRole("button", { name: "Restart" }));
    expect(await screen.findByText("1 of 3")).toBeInTheDocument();
  });

  it("supports keyboard: Space flips, ArrowRight = got it, ArrowLeft = practice again", async () => {
    const user = userEvent.setup();
    const onEvent = vi.fn();
    render(<Flashcards config={config} onEvent={onEvent} />);
    const card = screen.getByRole("button", { name: /^Flip card/ });
    card.focus();
    await user.keyboard(" ");
    expect(card).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("{ArrowLeft}");
    expect(await screen.findByText("2 of 3")).toBeInTheDocument();
    expect(screen.getByText("0 mastered")).toBeInTheDocument();
    // Arrow keys do nothing until the card is flipped.
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    (await screen.findByRole("button", { name: /^Flip card/ })).focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowRight}");
    expect(await screen.findByText("1 mastered")).toBeInTheDocument();
  });

  it("finishes after one pass when requireMastery is off and supports shuffle", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const cfg = flashcardsSchema.parse({
      ...config,
      id: "d2",
      behavior: { requireMastery: false, allowShuffle: true },
    });
    render(<Flashcards config={cfg} onComplete={onComplete} />);
    await user.click(screen.getByRole("button", { name: "Shuffle" }));
    for (let i = 0; i < 3; i++) {
      await user.click(await screen.findByRole("button", { name: /^Flip card/ }));
      await user.click(screen.getByRole("button", { name: "Practice again" }));
    }
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete.mock.calls[0]![0].score).toBe(0);
    expect(onComplete.mock.calls[0]![0].details.rounds).toBe(1);
    expect(screen.queryByText("Review round")).not.toBeInTheDocument();
  });

  it("renders an error state for invalid config", () => {
    render(
      <Flashcards config={{ id: "x", type: "flashcards", content: { cards: [] } } as never} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Flashcards config={config} resetKey={1} />);
    await user.click(screen.getByRole("button", { name: /^Flip card/ }));
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(await screen.findByText("1 mastered")).toBeInTheDocument();
    rerender(<Flashcards config={config} resetKey={2} />);
    await waitFor(() => expect(screen.getByText("0 mastered")).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /^Flip card/ })).toHaveLength(1),
    );
    expect(screen.getByRole("button", { name: /^Flip card/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
