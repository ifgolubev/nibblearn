import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoryCards } from "./StoryCards";
import { storyCardsSchema } from "@nibblearn/core";

const config = storyCardsSchema.parse({
  id: "story",
  type: "story-cards",
  title: "Welcome aboard",
  content: {
    cards: [
      {
        eyebrow: "Chapter 1",
        title: "Hello",
        body: "First paragraph.\n\nSecond paragraph.",
        layout: "cover",
      },
      {
        title: "Numbers",
        layout: "stat",
        stat: { value: "42", label: "clients" },
        expandable: { label: "Learn more", body: "Hidden detail." },
      },
      {
        title: "Quick check",
        body: "Answer the question.",
        check: {
          question: "What is CPC?",
          options: [{ text: "Cost per click", correct: true }, { text: "Clicks per campaign" }],
          explanation: "CPC is cost per click.",
        },
      },
      { body: "Teamwork wins.", title: "Agency founder", layout: "quote" },
    ],
  },
});

describe("StoryCards", () => {
  it("renders cards, reveals the expandable, requires the check and completes with a score", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<StoryCards config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("heading", { name: "Welcome aboard" })).toBeInTheDocument();
    expect(screen.getByText("Card 1 of 4")).toBeInTheDocument();
    expect(screen.getByText("Chapter 1")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Card 2 of 4")).toBeInTheDocument();
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.queryByText("Hidden detail.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Learn more" }));
    expect(await screen.findByText("Hidden detail.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Card 3 of 4")).toBeInTheDocument();
    await screen.findByText("What is CPC?");
    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Clicks per campaign/ }));
    expect(await screen.findByText("Not quite")).toBeInTheDocument();
    expect(screen.getByText("CPC is cost per click.")).toBeInTheDocument();
    expect(screen.getByText("Answered")).toBeInTheDocument();
    expect(next).toBeEnabled();
    await user.click(next);

    expect(await screen.findByText("Card 4 of 4")).toBeInTheDocument();
    expect(await screen.findByText("Teamwork wins.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0]![0];
    expect(result.score).toBe(0);
    expect(result.correct).toBe(0);
    expect(result.total).toBe(1);
    expect(result.details.checks).toEqual({ correct: 0, total: 1 });
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:answer");
    expect(await screen.findByRole("button", { name: "Restart" })).toBeInTheDocument();
  });

  it("completes without a score when there are no checks", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const noChecks = storyCardsSchema.parse({
      id: "s2",
      type: "story-cards",
      content: {
        cards: [
          { title: "One", body: "a" },
          { title: "Two", body: "b" },
        ],
      },
    });
    render(<StoryCards config={noChecks} onComplete={onComplete} />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("button", { name: "Finish" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0].score).toBeUndefined();
    expect(await screen.findByText("Well done!")).toBeInTheDocument();
  });

  it("navigates with arrow keys and hides Back when allowBack is false", async () => {
    const user = userEvent.setup();
    const first = render(<StoryCards config={config} />);
    screen.getByRole("button", { name: "Next" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(await screen.findByText("Card 2 of 4")).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(await screen.findByText("Card 1 of 4")).toBeInTheDocument();
    first.unmount();

    const noBack = storyCardsSchema.parse({ ...config, id: "nb", behavior: { allowBack: false } });
    render(<StoryCards config={noBack} />);
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("renders an error state for invalid config", () => {
    render(
      <StoryCards config={{ id: "x", type: "story-cards", content: { cards: [] } } as never} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<StoryCards config={config} resetKey={1} />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Card 2 of 4")).toBeInTheDocument();
    rerender(<StoryCards config={config} resetKey={2} />);
    await waitFor(() => expect(screen.getByText("Card 1 of 4")).toBeInTheDocument());
  });
});
