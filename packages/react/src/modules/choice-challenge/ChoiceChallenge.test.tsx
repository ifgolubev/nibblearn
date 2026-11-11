import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChoiceChallenge } from "./ChoiceChallenge";
import { choiceChallengeSchema } from "@nibblearn/core";

const config = choiceChallengeSchema.parse({
  id: "q",
  type: "choice-challenge",
  title: "KPI check",
  content: {
    questions: [
      {
        prompt: "Which KPI measures efficiency?",
        options: [
          { text: "CPA", correct: true, explanation: "Cost per acquisition." },
          { text: "Impressions" },
        ],
        explanation: "CPA ties spend to results.",
      },
      {
        prompt: "Select all cost metrics",
        options: [{ text: "CPC", correct: true }, { text: "CPM", correct: true }, { text: "CTR" }],
      },
    ],
  },
});

describe("ChoiceChallenge", () => {
  it("renders, checks answers, shows feedback and completes with a score", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<ChoiceChallenge config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("heading", { name: "KPI check" })).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
    const check = screen.getByRole("button", { name: "Check" });
    expect(check).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /CPA/ }));
    await user.click(check);
    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(screen.getByText("CPA ties spend to results.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Question 2 of 2")).toBeInTheDocument();
    await user.click(await screen.findByRole("checkbox", { name: /CPC/ }));
    await user.click(screen.getByRole("checkbox", { name: /CTR/ }));
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("Not quite")).toBeInTheDocument();
    // Retry allowed by default
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await user.click(screen.getByRole("checkbox", { name: /CPC/ }));
    await user.click(screen.getByRole("checkbox", { name: /CPM/ }));
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("Correct")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0]![0];
    expect(result.correct).toBe(2);
    expect(result.total).toBe(2);
    expect(result.score).toBeGreaterThan(0.8);
    expect(result.score).toBeLessThan(1);
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:complete");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("supports keyboard selection and Enter to check", async () => {
    const user = userEvent.setup();
    render(<ChoiceChallenge config={config} />);
    screen.getByRole("radio", { name: /Impressions/ }).focus();
    await user.keyboard("a");
    expect(screen.getByRole("radio", { name: /CPA/ })).toHaveAttribute("data-state", "selected");
    await user.keyboard("{Enter}");
    expect(screen.getByText("Correct")).toBeInTheDocument();
  });

  it("renders an error state for invalid config", () => {
    render(
      <ChoiceChallenge
        config={{ id: "x", type: "choice-challenge", content: { questions: [] } } as never}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ChoiceChallenge config={config} resetKey={1} />);
    await user.click(screen.getByRole("radio", { name: /CPA/ }));
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("Correct")).toBeInTheDocument();
    rerender(<ChoiceChallenge config={config} resetKey={2} />);
    await waitFor(() => expect(screen.queryByText("Correct")).not.toBeInTheDocument());
    expect(await screen.findByRole("button", { name: "Check" })).toBeDisabled();
  });
});
