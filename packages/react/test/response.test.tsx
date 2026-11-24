import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { gradeModule, trueFalseSchema, type ModuleResult } from "@nibblearn/core";
import { createExample } from "@nibblearn/core/examples";
import { TrueFalse } from "../src/modules/true-false/TrueFalse";
import { latestState } from "./state-helpers";

const config = trueFalseSchema.parse({
  ...createExample("true-false"),
  behavior: { shuffle: false, showExplanation: true },
});
const total = config.content.statements.length;

async function answer(user: ReturnType<typeof userEvent.setup>, from: number, to: number) {
  for (let i = from; i < to; i++) {
    const truth = config.content.statements[i]!.isTrue;
    await user.click(
      screen.getByRole("button", { name: truth ? /Mark as true/ : /Mark as false/ }),
    );
    await user.click(await screen.findByRole("button", { name: /^(Continue|Finish)$/ }));
  }
}

describe("ModuleResult.response", () => {
  it("lists what the learner submitted, and the server grade matches the result", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<TrueFalse config={config} onComplete={onComplete} />);
    await answer(user, 0, total);
    const result = onComplete.mock.lastCall![0] as ModuleResult;
    expect(result.response?.answers).toEqual(
      config.content.statements.map((s, itemIndex) => ({ itemIndex, response: s.isTrue })),
    );
    // Only what was submitted: no verdicts for a server to take on trust.
    expect(JSON.stringify(result.response)).not.toMatch(/correct|score/);
    const graded = gradeModule(config, JSON.parse(JSON.stringify(result.response)));
    expect(graded.success && graded.grade).toMatchObject({
      score: result.score,
      correct: total,
      total,
      complete: true,
    });
  });

  it("survives a restored session and starts again after a reset", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const first = render(<TrueFalse config={config} onStateChange={onStateChange} />);
    await answer(user, 0, 1);
    const saved = await latestState(onStateChange);
    first.unmount();

    const onComplete = vi.fn();
    const { rerender } = render(
      <TrueFalse config={config} initialState={saved} onComplete={onComplete} resetKey={0} />,
    );
    await answer(user, 1, total);
    const result = onComplete.mock.lastCall![0] as ModuleResult;
    expect(result.response?.answers).toHaveLength(total);
    expect(result.response?.answers[0]).toEqual({
      itemIndex: 0,
      response: config.content.statements[0]!.isTrue,
    });

    rerender(
      <TrueFalse config={config} initialState={saved} onComplete={onComplete} resetKey={1} />,
    );
    await answer(user, 0, total);
    const again = onComplete.mock.lastCall![0] as ModuleResult;
    expect(again.response?.answers).toHaveLength(total);
  });

  it("starts a fresh run when the saved answer log is not a list", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const first = render(<TrueFalse config={config} onStateChange={onStateChange} />);
    await answer(user, 0, 1);
    const saved = await latestState(onStateChange);
    first.unmount();
    const onComplete = vi.fn();
    render(
      <TrueFalse
        config={config}
        initialState={{ ...saved, data: { ...saved.data, "nb:answers": { length: 5 } } }}
        onComplete={onComplete}
      />,
    );
    // Nothing of the session is kept: the deck starts at its first statement.
    await answer(user, 0, total);
    const result = onComplete.mock.lastCall![0] as ModuleResult;
    expect(result.response?.answers).toHaveLength(total);
  });

  it("reports no response for a session saved without an answer log", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const first = render(<TrueFalse config={config} onStateChange={onStateChange} />);
    await answer(user, 0, 1);
    const saved = await latestState(onStateChange);
    first.unmount();
    // As saved by a version that kept no log.
    const { "nb:answers": _log, ...data } = saved.data;
    const onComplete = vi.fn();
    render(<TrueFalse config={config} initialState={{ ...saved, data }} onComplete={onComplete} />);
    await answer(user, 1, total);
    const result = onComplete.mock.lastCall![0] as ModuleResult;
    expect(result.score).toBe(1);
    expect(result.response).toBeUndefined();
  });
});
