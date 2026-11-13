import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { wordBuilderSchema } from "@nibblearn/core";
import { WordBuilder } from "./WordBuilder";

const config = wordBuilderSchema.parse({
  id: "wb",
  type: "word-builder",
  title: "Build it right",
  content: {
    items: [
      {
        id: "roas",
        prompt: "Build the formula for ROAS.",
        tokens: ["ROAS", "=", "Revenue", "÷", "Ad spend"],
        distractors: ["Clicks"],
        display: "formula",
        hint: "Spend is in the name.",
        explanation: "ROAS = revenue ÷ ad spend.",
      },
      {
        id: "brief",
        prompt: "Order the rule.",
        tokens: ["Confirm", "the", "brief", "before", "the", "build"],
        distractors: ["after"],
      },
    ],
  },
  behavior: { shuffleSeed: 3 },
});

const bank = () => screen.getByRole("group", { name: "Word bank" });
const answer = () => screen.getByRole("list", { name: "Your answer" });
const bankTile = (name: string) => within(bank()).getAllByRole("button", { name })[0]!;

async function build(user: ReturnType<typeof userEvent.setup>, tokens: string[]) {
  for (const tok of tokens) await user.click(bankTile(tok));
}

describe("WordBuilder", () => {
  it("builds both answers by tapping tiles and completes with full credit", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<WordBuilder config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("heading", { name: "Build it right" })).toBeInTheDocument();
    expect(screen.getByText("Item 1 of 2")).toBeInTheDocument();
    expect(within(bank()).getAllByRole("button")).toHaveLength(6);
    const check = screen.getByRole("button", { name: "Check" });
    expect(check).toBeDisabled();

    await build(user, ["ROAS", "=", "Revenue", "÷", "Ad spend"]);
    expect(within(answer()).getAllByRole("button")).toHaveLength(5);
    expect(
      within(answer()).getByRole("button", { name: "Revenue, position 3" }),
    ).toBeInTheDocument();
    // Placed tiles leave a ghost in the bank, so only the distractor is still a button.
    expect(within(bank()).getAllByRole("button")).toHaveLength(1);
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:interact");

    await user.click(check);
    expect(await screen.findByText("That's the right order!")).toBeInTheDocument();
    for (const tile of within(answer()).getAllByRole("button")) {
      expect(tile).toHaveAttribute("data-state", "correct");
    }
    expect(screen.getByText("ROAS = revenue ÷ ad spend.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Item 2 of 2")).toBeInTheDocument();
    // Duplicate tokens are interchangeable.
    await waitFor(() => expect(screen.getByText("Order the rule.")).toBeInTheDocument());
    await build(user, ["Confirm", "the", "brief", "before", "the", "build"]);
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("That's the right order!")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const result = onComplete.mock.calls[0]![0];
    expect(result.score).toBe(1);
    expect(result.correct).toBe(2);
    expect(result.total).toBe(2);
    expect(result.details.items).toHaveLength(2);
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("marks wrong positions, keeps the correct prefix on retry and decays the score", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const single = wordBuilderSchema.parse({
      ...config,
      content: { items: [config.content.items[0]] },
    });
    render(<WordBuilder config={single} onComplete={onComplete} />);
    expect(screen.queryByText(/Item 1 of/)).not.toBeInTheDocument();

    await build(user, ["ROAS", "=", "Ad spend", "÷", "Revenue"]);
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("3 of 5 tiles in the right place")).toBeInTheDocument();
    const states = within(answer())
      .getAllByRole("button")
      .map((b) => b.getAttribute("data-state"));
    expect(states).toEqual(["correct", "correct", "incorrect", "correct", "incorrect"]);
    expect(within(answer()).getAllByRole("button")[2]).toHaveAccessibleName(
      "Ad spend, position 3, Not quite",
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(within(answer()).getAllByRole("button")).toHaveLength(2);
    await build(user, ["Revenue", "÷", "Ad spend"]);
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("That's the right order!")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onComplete.mock.calls[0]![0].score).toBe(0.75);
  });

  it("supports keyboard: Enter adds, Enter on a placed tile and Backspace send tiles back", async () => {
    const user = userEvent.setup();
    render(<WordBuilder config={config} />);
    bankTile("ROAS").focus();
    await user.keyboard("{Enter}");
    expect(within(answer()).getByRole("button", { name: "ROAS, position 1" })).toBeInTheDocument();
    bankTile("=").focus();
    await user.keyboard("{Enter}");
    expect(within(answer()).getAllByRole("button")).toHaveLength(2);
    // Focus moves on to the next free bank tile, so Backspace works from the bank.
    await waitFor(() => expect(bank()).toContainElement(document.activeElement as HTMLElement));

    await user.keyboard("{Backspace}");
    expect(within(answer()).getAllByRole("button")).toHaveLength(1);
    expect(bankTile("=")).toBeInTheDocument();

    within(answer()).getByRole("button", { name: "ROAS, position 1" }).focus();
    await user.keyboard("{Enter}");
    expect(within(answer()).queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
  });

  it("reveals the correct answer when attempts run out", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const strict = wordBuilderSchema.parse({
      ...config,
      content: { items: [config.content.items[0]] },
      behavior: { shuffleSeed: 3, maxAttempts: 1 },
    });
    render(<WordBuilder config={strict} onComplete={onComplete} />);
    await build(user, ["Clicks"]);
    await user.click(screen.getByRole("button", { name: "Check" }));
    const solution = await screen.findByRole("group", { name: "Correct answer" });
    expect(solution).toHaveTextContent("ROAS=Revenue÷Ad spend");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onComplete.mock.calls[0]![0].score).toBe(0);
    expect(screen.getByText(/Your answer: Clicks/)).toBeInTheDocument();
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<WordBuilder config={config} resetKey={1} />);
    await build(user, ["ROAS", "="]);
    expect(within(answer()).getAllByRole("button")).toHaveLength(2);
    rerender(<WordBuilder config={config} resetKey={2} />);
    await waitFor(() => expect(within(answer()).queryAllByRole("button")).toHaveLength(0));
  });

  it("renders an alert for invalid config", () => {
    render(
      <WordBuilder
        config={
          {
            id: "x",
            type: "word-builder",
            content: { items: [{ prompt: "p", tokens: ["a", "b"], alternatives: [["a", "c"]] }] },
          } as never
        }
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/alternatives must use/);
  });
});
