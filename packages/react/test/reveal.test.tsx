import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  choiceChallengeSchema,
  scoringSchema,
  sequenceBuilderSchema,
  type ModuleResult,
} from "@nibblearn/core";
import { createExample } from "@nibblearn/core/examples";
import { useRevealAnswers } from "../src/hooks/useRevealAnswers";
import type { ModuleLifecycle } from "../src/hooks/useModuleLifecycle";
import { ChoiceChallenge } from "../src/modules/choice-challenge/ChoiceChallenge";
import { SequenceBuilder } from "../src/modules/sequence-builder/SequenceBuilder";

type Policy = "always" | "after-pass" | "never";

const quiz = (revealAnswers: Policy) =>
  choiceChallengeSchema.parse({
    id: "q",
    type: "choice-challenge",
    content: {
      questions: [
        {
          prompt: "Which are paid per click?",
          explanation: "Search and shopping ads are billed per click.",
          options: [
            { text: "Search", correct: true },
            { text: "Shopping", correct: true },
            { text: "Billboard", explanation: "Billboards are booked by time." },
          ],
        },
      ],
    },
    behavior: { allowRetry: false },
    scoring: { revealAnswers },
  });

async function answerWrong(policy: Policy) {
  const user = userEvent.setup();
  render(<ChoiceChallenge config={quiz(policy)} />);
  await user.click(screen.getByRole("checkbox", { name: /Search/ }));
  await user.click(screen.getByRole("checkbox", { name: /Billboard/ }));
  await user.click(screen.getByRole("button", { name: "Check" }));
}

describe("scoring.revealAnswers", () => {
  it("defaults to always", () => {
    expect(scoringSchema.parse(undefined).revealAnswers).toBe("always");
    expect(scoringSchema.parse({ passThreshold: 0.8 }).revealAnswers).toBe("always");
  });

  it("always: a checked question shows the options that were missed", async () => {
    await answerWrong("always");
    expect(screen.getByRole("checkbox", { name: /Shopping/ })).toHaveAttribute(
      "data-state",
      "missed",
    );
    expect(screen.getByText(/billed per click/)).toBeInTheDocument();
  });

  it.each(["never", "after-pass"] as const)(
    "%s: shows what was wrong, not what was right",
    async (policy) => {
      await answerWrong(policy);
      expect(screen.getByRole("checkbox", { name: /Billboard/ })).toHaveAttribute(
        "data-state",
        "incorrect",
      );
      expect(screen.getByRole("checkbox", { name: /Search/ })).toHaveAttribute(
        "data-state",
        "correct",
      );
      expect(screen.getByRole("checkbox", { name: /Shopping/ })).toHaveAttribute(
        "data-state",
        "idle",
      );
      // The learner's own wrong pick is explained; the question's answer is not.
      expect(screen.getByText(/booked by time/)).toBeInTheDocument();
      expect(screen.queryByText(/billed per click/)).toBeNull();
      expect(screen.queryByText(/You missed/)).toBeNull();
    },
  );

  it("sequence: the correct order appears only when answers may be shown", async () => {
    const user = userEvent.setup();
    const config = (revealAnswers: Policy) =>
      sequenceBuilderSchema.parse({
        ...createExample("sequence-builder"),
        behavior: { allowRetry: false },
        scoring: { revealAnswers },
      });
    const shown = render(<SequenceBuilder config={config("always")} />);
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByRole("region", { name: "Correct order" })).toBeInTheDocument();
    shown.unmount();

    render(<SequenceBuilder config={config("never")} />);
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.queryByRole("region", { name: "Correct order" })).toBeNull();
    // The learner can still finish.
    expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument();
  });

  it("after-pass: answers open once the module is completed above the threshold", () => {
    const life = (score?: number) =>
      ({ result: score === undefined ? null : ({ score } as ModuleResult) }) as ModuleLifecycle;
    const scoring = scoringSchema.parse({ passThreshold: 0.8, revealAnswers: "after-pass" });
    expect(useRevealAnswers(life(), scoring)).toBe(false);
    expect(useRevealAnswers(life(0.6), scoring)).toBe(false);
    expect(useRevealAnswers(life(0.8), scoring)).toBe(true);
    // Without a threshold of its own, a module passes at 0.7.
    const unset = scoringSchema.parse({ revealAnswers: "after-pass" });
    expect(useRevealAnswers(life(0.6), unset)).toBe(false);
    expect(useRevealAnswers(life(0.7), unset)).toBe(true);
    expect(useRevealAnswers(life(1), { ...scoring, revealAnswers: "never" })).toBe(false);
    expect(useRevealAnswers(life(), { ...scoring, revealAnswers: "always" })).toBe(true);
  });
});
