import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChoiceChallenge } from "./ChoiceChallenge";
import { NibblearnProvider, type CompletionInfo } from "../../context/NibblearnProvider";
import { choiceChallengeSchema } from "@nibblearn/core";
import { latestState } from "../../../test/state-helpers";

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

  it("restores mid-progress from a saved state", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const first = render(<ChoiceChallenge config={config} onStateChange={onStateChange} />);
    await user.click(screen.getByRole("radio", { name: /CPA/ }));
    await user.click(screen.getByRole("button", { name: "Check" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("checkbox", { name: /CPC/ }));
    const saved = await latestState(onStateChange);
    first.unmount();

    const onEvent = vi.fn();
    render(<ChoiceChallenge config={config} initialState={saved} onEvent={onEvent} />);
    expect(screen.getByText("Question 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /CPC/ })).toHaveAttribute("data-state", "selected");
    expect(screen.getByRole("checkbox", { name: /CPM/ })).toHaveAttribute("data-state", "idle");
    // Resuming does not count as a new start.
    expect(onEvent.mock.calls.map((c) => c[0].type)).not.toContain("module:start");
  });

  it("restores a completed session without completing again", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const first = render(<ChoiceChallenge config={config} onStateChange={onStateChange} />);
    await user.click(screen.getByRole("radio", { name: /CPA/ }));
    await user.click(screen.getByRole("button", { name: "Check" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("checkbox", { name: /CPC/ }));
    await user.click(screen.getByRole("checkbox", { name: /CPM/ }));
    await user.click(screen.getByRole("button", { name: "Check" }));
    await user.click(screen.getByRole("button", { name: "Finish" }));
    const saved = await latestState(onStateChange);
    expect(saved.result?.score).toBe(1);
    first.unmount();

    const onComplete = vi.fn();
    render(<ChoiceChallenge config={config} initialState={saved} onComplete={onComplete} />);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText(/Question \d of 2/)).not.toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe("ChoiceChallenge result details", () => {
  it("reports the selected options of every question in details", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<ChoiceChallenge config={config} onComplete={onComplete} />);
    await user.click(screen.getByRole("radio", { name: /Impressions/ }));
    await user.click(screen.getByRole("button", { name: "Check" }));
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await user.click(screen.getByRole("radio", { name: /CPA/ }));
    await user.click(screen.getByRole("button", { name: "Check" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("checkbox", { name: /CPC/ }));
    await user.click(screen.getByRole("checkbox", { name: /CPM/ }));
    await user.click(screen.getByRole("button", { name: "Check" }));
    await user.click(screen.getByRole("button", { name: "Finish" }));
    const details = onComplete.mock.calls[0]![0].details;
    expect(details.responses).toEqual([["q0-opt0"], ["q1-opt0", "q1-opt1"]]);
    expect(details.records[0]).toMatchObject({ selected: ["q0-opt0"], attempts: 2 });
  });
});

const external = choiceChallengeSchema.parse({
  id: "ext",
  type: "choice-challenge",
  title: "Server-graded quiz",
  content: {
    questions: [
      {
        id: "q-1",
        prompt: "Which KPI measures efficiency?",
        mode: "single",
        options: [
          { id: "cpa", text: "CPA" },
          { id: "imp", text: "Impressions" },
        ],
      },
      {
        id: "q-2",
        prompt: "Select all cost metrics",
        mode: "multiple",
        options: [
          { id: "cpc", text: "CPC" },
          { id: "cpm", text: "CPM" },
          { id: "ctr", text: "CTR" },
        ],
      },
    ],
  },
  behavior: { evaluation: "external" },
});

describe("ChoiceChallenge with external evaluation", () => {
  it("needs correct options unless evaluation is external", () => {
    const base = {
      id: "x",
      type: "choice-challenge",
      content: { questions: [{ prompt: "?", options: [{ text: "a" }, { text: "b" }] }] },
    };
    const local = choiceChallengeSchema.safeParse(base);
    expect(local.success).toBe(false);
    if (!local.success) {
      expect(local.error.issues[0]!.path).toEqual(["content", "questions", 0, "options"]);
      expect(local.error.issues[0]!.message).toBe(
        "each question needs at least one correct option",
      );
    }
    expect(
      choiceChallengeSchema.safeParse({ ...base, behavior: { evaluation: "external" } }).success,
    ).toBe(true);
    // The parsed config of an ordinary quiz is unchanged (no new default appears).
    expect(config.behavior).not.toHaveProperty("evaluation");
  });

  it("collects answers without checking them and submits once", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(
      <ChoiceChallenge
        config={external}
        onSubmit={onSubmit}
        onComplete={onComplete}
        onEvent={onEvent}
      />,
    );
    expect(screen.queryByRole("button", { name: "Check" })).not.toBeInTheDocument();
    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /Impressions/ }));
    await user.click(next);
    // No verdict is shown at any point.
    expect(screen.queryByText("Correct")).not.toBeInTheDocument();
    expect(screen.queryByText("Not quite")).not.toBeInTheDocument();

    expect(await screen.findByText("Question 2 of 2")).toBeInTheDocument();
    await user.click(await screen.findByRole("checkbox", { name: /CPC/ }));

    // Go back, change the first answer, and return: the second answer is kept.
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(await screen.findByRole("radio", { name: /CPA/ }));
    expect(screen.getByRole("radio", { name: /CPA/ })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("checkbox", { name: /CPC/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(screen.getByRole("checkbox", { name: /CPM/ }));
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Submit answers" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith([["cpa"], ["cpc", "cpm"]]);
    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0]![0];
    expect(result.score).toBeUndefined();
    expect(result.details).toEqual({
      evaluation: "external",
      responses: [["cpa"], ["cpc", "cpm"]],
    });
    expect(await screen.findByText("Answers submitted")).toBeInTheDocument();

    const answers = onEvent.mock.calls.map((c) => c[0]).filter((e) => e.type === "module:answer");
    expect(answers.at(-1).payload).toMatchObject({ itemIndex: 1, response: ["cpc", "cpm"] });
    expect(answers.every((e) => !("correct" in e.payload))).toBe(true);
  });

  it("restores collected answers and does not submit in preview", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const { unmount } = render(<ChoiceChallenge config={external} onStateChange={onStateChange} />);
    await user.click(screen.getByRole("radio", { name: /CPA/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Question 2 of 2");
    const saved = await latestState(onStateChange);
    unmount();

    const onSubmit = vi.fn();
    const second = render(
      <ChoiceChallenge config={external} initialState={saved} onSubmit={onSubmit} />,
    );
    expect(screen.getByText("Question 2 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /CTR/ }));
    await user.click(screen.getByRole("button", { name: "Submit answers" }));
    expect(onSubmit).toHaveBeenCalledWith([["cpa"], ["ctr"]]);
    second.unmount();

    const previewSubmit = vi.fn();
    render(<ChoiceChallenge config={external} mode="preview" onSubmit={previewSubmit} />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("button", { name: "Submit answers" }));
    expect(previewSubmit).not.toHaveBeenCalled();
  });

  it("lets the host hide or replace the completion card", async () => {
    const user = userEvent.setup();
    const answerAll = async () => {
      await user.click(screen.getByRole("radio", { name: /CPA/ }));
      await user.click(screen.getByRole("button", { name: "Next" }));
      await user.click(await screen.findByRole("checkbox", { name: /CPC/ }));
      await user.click(screen.getByRole("button", { name: "Submit answers" }));
    };
    const onComplete = vi.fn();
    const hidden = render(
      <NibblearnProvider completion="hidden">
        <ChoiceChallenge config={external} onComplete={onComplete} />
      </NibblearnProvider>,
    );
    await answerAll();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Answers submitted")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    hidden.unmount();

    const custom = (info: CompletionInfo) => (
      <div>
        <p>Host result: {info.title}</p>
        <button onClick={info.onRetry}>Host retry</button>
      </div>
    );
    render(
      <NibblearnProvider completion={custom}>
        <ChoiceChallenge config={external} />
      </NibblearnProvider>,
    );
    await answerAll();
    expect(await screen.findByText("Host result: Answers submitted")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Host retry" }));
    expect(await screen.findByText("Question 1 of 2")).toBeInTheDocument();
  });
});

describe("ChoiceChallenge review", () => {
  const review = {
    items: [
      {
        selected: ["imp"],
        correct: ["cpa"],
        explanation: "CPA ties spend to results.",
        optionExplanations: { imp: "Impressions only count views." },
      },
      { selected: ["cpc", "cpm"], correct: ["cpc", "cpm"] },
    ],
  };

  it("shows the chosen and the correct options with explanations, read-only", () => {
    const onEvent = vi.fn();
    const onComplete = vi.fn();
    render(
      <ChoiceChallenge
        config={external}
        review={review}
        onEvent={onEvent}
        onComplete={onComplete}
      />,
    );
    expect(screen.getByRole("heading", { name: "Which KPI measures efficiency?" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Select all cost metrics" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Check" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit|Next/ })).not.toBeInTheDocument();

    const wrong = screen.getByRole("radio", { name: /Impressions/ });
    expect(wrong).toHaveAttribute("data-state", "incorrect");
    expect(wrong).toHaveAccessibleName(/Your answer/);
    expect(wrong).toBeDisabled();
    const missed = screen.getByRole("radio", { name: /CPA/ });
    expect(missed).toHaveAttribute("data-state", "missed");
    expect(missed).toHaveAccessibleName(/Correct answer/);
    expect(screen.getByText("Impressions only count views.")).toBeInTheDocument();
    expect(screen.getByText("CPA ties spend to results.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /CPC/ })).toHaveAttribute("data-state", "correct");
    expect(screen.getByRole("checkbox", { name: /CTR/ })).toHaveAttribute("data-state", "idle");
    expect(screen.getByText("Not quite")).toBeInTheDocument();
    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(onEvent).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("handles missing data: no correct options, unanswered questions, a server verdict", () => {
    render(
      <ChoiceChallenge
        config={external}
        review={{ items: [{ selected: ["cpa"], isCorrect: true }] }}
      />,
    );
    expect(screen.getByRole("radio", { name: /CPA/ })).toHaveAttribute("data-state", "correct");
    expect(screen.getByRole("radio", { name: /Impressions/ })).toHaveAttribute(
      "data-state",
      "idle",
    );
    expect(screen.getByText("Not answered")).toBeInTheDocument();
  });

  it("uses the correct options of a locally checked config and ignores unknown ids", () => {
    render(
      <ChoiceChallenge
        config={config}
        review={{
          items: [
            { selected: ["q0-opt0", "constructor"], optionExplanations: { toString: "x" } },
            { selected: ["q1-opt2"] },
          ],
        }}
      />,
    );
    expect(screen.getByRole("radio", { name: /CPA/ })).toHaveAttribute("data-state", "correct");
    expect(screen.getByText("Cost per acquisition.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /CTR/ })).toHaveAttribute(
      "data-state",
      "incorrect",
    );
    expect(screen.getByRole("checkbox", { name: /CPC/ })).toHaveAttribute("data-state", "missed");
  });

  it("reports invalid review data", () => {
    render(<ChoiceChallenge config={external} review={{ items: "nope" } as never} />);
    expect(screen.getByRole("alert")).toHaveTextContent("review.items");
  });
});
