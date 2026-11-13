import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FillBlanks } from "./FillBlanks";
import { fillBlanksSchema } from "@nibblearn/core";

const base = {
  id: "fb",
  type: "fill-blanks",
  title: "Metric formulas",
  content: {
    template: "ROAS equals {{roas}} divided by spend. CTR equals clicks divided by {{ctr}}.",
    blanks: [
      { id: "roas", answers: ["revenue"], hint: "Money that comes back." },
      { id: "ctr", answers: ["impressions"] },
    ],
    distractors: ["clicks"],
    explanation: "ROAS = revenue / spend; CTR = clicks / impressions.",
  },
  behavior: { shuffleBank: false },
} as const;

const bankConfig = fillBlanksSchema.parse(base);
const typedConfig = fillBlanksSchema.parse({
  ...base,
  behavior: { mode: "typed", shuffleBank: false },
});

describe("FillBlanks (word bank)", () => {
  it("fills blanks from the bank, checks, retries and completes", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<FillBlanks config={bankConfig} onComplete={onComplete} />);

    expect(screen.getByRole("heading", { name: "Metric formulas" })).toBeInTheDocument();
    const bank = screen.getByRole("group", { name: "Word bank" });
    const check = screen.getByRole("button", { name: "Check" });
    expect(check).toBeDisabled();

    // Wrong word into the first blank, correct into the second.
    await user.click(within(bank).getByRole("button", { name: "clicks" }));
    expect(screen.getByRole("button", { name: /Blank 1: clicks/ })).toBeInTheDocument();
    // The used chip becomes a ghost placeholder.
    expect(within(bank).queryByRole("button", { name: "clicks" })).not.toBeInTheDocument();
    await user.click(within(bank).getByRole("button", { name: "impressions" }));
    expect(check).toBeEnabled();
    await user.click(check);

    expect(await screen.findByText("1 of 2 blanks correct")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Blank 1/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("button", { name: /^Blank 2/ })).toHaveAttribute(
      "data-state",
      "correct",
    );
    // Answer is not revealed while retries remain.
    expect(screen.queryByText(/Answer:/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    // Only the incorrect blank was cleared.
    expect(screen.getByRole("button", { name: "Blank 1" })).toHaveAttribute("data-state", "empty");
    expect(screen.getByRole("button", { name: /Blank 2: impressions/ })).toBeInTheDocument();
    await user.click(within(bank).getByRole("button", { name: "revenue" }));
    await user.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByText("All blanks filled correctly!")).toBeInTheDocument();
    expect(screen.getByText(/ROAS = revenue \/ spend/)).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0]![0];
    expect(result.correct).toBe(2);
    expect(result.total).toBe(2);
    expect(result.score).toBe(0.75);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("selects a slot to target it, returns words to the bank and toggles hints", async () => {
    const user = userEvent.setup();
    const onEvent = vi.fn();
    render(<FillBlanks config={bankConfig} onEvent={onEvent} />);
    const bank = screen.getByRole("group", { name: "Word bank" });

    await user.click(screen.getByRole("button", { name: "Blank 2" }));
    expect(screen.getByRole("button", { name: "Blank 2" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(bank).getByRole("button", { name: "revenue" }));
    expect(screen.getByRole("button", { name: /Blank 2: revenue/ })).toBeInTheDocument();
    // Tapping a filled slot returns the word.
    await user.click(screen.getByRole("button", { name: /Blank 2: revenue/ }));
    expect(within(bank).getByRole("button", { name: "revenue" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hint: Blank 1" }));
    expect(screen.getByRole("note")).toHaveTextContent("Money that comes back.");
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:hint");
    await user.click(screen.getByRole("button", { name: "Hint: Blank 1" }));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("reveals answers and locks when retry is not allowed", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const cfg = fillBlanksSchema.parse({
      ...base,
      behavior: { allowRetry: false, shuffleBank: false },
    });
    render(<FillBlanks config={cfg} onComplete={onComplete} />);
    const bank = screen.getByRole("group", { name: "Word bank" });
    await user.click(within(bank).getByRole("button", { name: "clicks" }));
    await user.click(within(bank).getByRole("button", { name: "revenue" }));
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Answer: revenue")).toBeInTheDocument();
    expect(screen.getByText("Answer: impressions")).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0].score).toBe(0);
    expect(screen.queryByRole("group", { name: "Word bank" })).not.toBeInTheDocument();
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FillBlanks config={bankConfig} resetKey={1} />);
    const bank = screen.getByRole("group", { name: "Word bank" });
    await user.click(within(bank).getByRole("button", { name: "revenue" }));
    expect(screen.getByRole("button", { name: /Blank 1: revenue/ })).toBeInTheDocument();
    rerender(<FillBlanks config={bankConfig} resetKey={2} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Blank 1" })).toHaveAttribute(
        "data-state",
        "empty",
      ),
    );
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
  });

  it("renders an error state for invalid config", () => {
    render(
      <FillBlanks
        config={
          {
            id: "x",
            type: "fill-blanks",
            content: { template: "No {{missing}}", blanks: [{ id: "a", answers: ["a"] }] },
          } as never
        }
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });
});

describe("FillBlanks (typed)", () => {
  it("accepts typed answers case-insensitively and checks on Enter", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<FillBlanks config={typedConfig} onComplete={onComplete} />);
    const first = screen.getByRole("textbox", { name: "Blank 1" });
    const second = screen.getByRole("textbox", { name: "Blank 2" });
    await user.type(first, "Revenue");
    await user.type(second, " impressions.");
    await user.keyboard("{Enter}");
    expect(await screen.findByText("All blanks filled correctly!")).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0].score).toBe(1);
  });

  it("marks wrong typed answers invalid and clears only those on retry", async () => {
    const user = userEvent.setup();
    render(<FillBlanks config={typedConfig} />);
    await user.type(screen.getByRole("textbox", { name: "Blank 1" }), "spend");
    await user.type(screen.getByRole("textbox", { name: "Blank 2" }), "impressions");
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("1 of 2 blanks correct")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Blank 1" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("textbox", { name: "Blank 1" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Blank 2" })).toHaveValue("impressions");
  });
});

describe("FillBlanks rich text", () => {
  it("renders inline markup in the template safely", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { fillBlanksSchema } = await import("@nibblearn/core");
    const config = fillBlanksSchema.parse({
      id: "md",
      type: "fill-blanks",
      content: {
        template: "**ROAS** = revenue / {{a}} <b>x</b>",
        blanks: [{ id: "a", answers: ["spend"] }],
      },
    });
    const { container } = render(<FillBlanks config={config} />);
    expect(container.querySelector("strong")?.textContent).toBe("ROAS");
    expect(screen.queryByText(/\*\*ROAS\*\*/)).not.toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
  });
});
