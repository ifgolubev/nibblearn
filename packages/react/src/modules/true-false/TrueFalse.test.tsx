import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrueFalse } from "./TrueFalse";
import { trueFalseSchema } from "@nibblearn/core";

const config = trueFalseSchema.parse({
  id: "tf",
  type: "true-false",
  title: "Metric myths",
  content: {
    statements: [
      {
        text: "CTR is clicks divided by impressions.",
        isTrue: true,
        explanation: "Yes, that is the definition.",
        tag: "Rates",
      },
      {
        text: "A lower ROAS is always better.",
        isTrue: false,
        explanation: "Higher ROAS means more revenue per unit of spend.",
      },
      {
        text: "CPM is a cost per thousand impressions.",
        isTrue: true,
        explanation: "The M stands for mille.",
      },
    ],
  },
});

describe("TrueFalse", () => {
  it("answers with buttons, shows explanations, and completes with a score and review list", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<TrueFalse config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("heading", { name: "Metric myths" })).toBeInTheDocument();
    expect(screen.getByText("Statement 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Rates")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Mark as true/ }));
    expect(await screen.findByText("Correct")).toBeInTheDocument();
    expect(screen.getByText("Yes, that is the definition.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark as false/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Statement 2 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Mark as true/ }));
    expect(await screen.findByText("Not quite")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Statement 3 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Mark as false/ }));
    await user.click(await screen.findByRole("button", { name: "Finish" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0]![0];
    expect(result.correct).toBe(1);
    expect(result.total).toBe(3);
    expect(result.score).toBeCloseTo(1 / 3);
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:answer");
    expect(await screen.findByText("1 of 3 correct")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute("data-ok", "true");
    expect(items[1]).toHaveAttribute("data-ok", "false");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Statement 1 of 3")).toBeInTheDocument();
  });

  it("supports keyboard shortcuts (T/F, arrows, Enter)", async () => {
    const user = userEvent.setup();
    const onEvent = vi.fn();
    render(<TrueFalse config={config} onEvent={onEvent} />);
    screen.getByRole("button", { name: /Mark as true/ }).focus();
    await user.keyboard("t");
    expect(await screen.findByText("Correct")).toBeInTheDocument();
    // Enter while focus is on the module body continues.
    screen.getByRole("button", { name: "Continue" }).focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Statement 2 of 3")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Correct")).not.toBeInTheDocument());
    expect(screen.getByRole("group", { name: "Statement 2 of 3" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(await screen.findByText("Correct")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Statement 3 of 3")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Correct")).not.toBeInTheDocument());
    await user.keyboard("{ArrowRight}");
    expect(await screen.findByText("Correct")).toBeInTheDocument();
    expect(
      onEvent.mock.calls.filter((c) => c[0].type === "module:answer").map((c) => c[0].payload.via),
    ).toEqual(["key", "key", "key"]);
  });

  it("auto-advances when showExplanation is off and uses custom labels", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const cfg = trueFalseSchema.parse({
      ...config,
      id: "tf2",
      behavior: { showExplanation: false, trueLabel: "Fact", falseLabel: "Myth", swipe: false },
    });
    render(<TrueFalse config={cfg} onComplete={onComplete} />);
    expect(screen.queryByText("Swipe or use the buttons")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark as true: Fact" }));
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    expect(
      await screen.findByText("Statement 2 of 3", undefined, { timeout: 2000 }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark as false: Myth" }));
    expect(
      await screen.findByText("Statement 3 of 3", undefined, { timeout: 2000 }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark as true: Fact" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(onComplete.mock.calls[0]![0].score).toBe(1);
  });

  it("renders an error state for invalid config", () => {
    render(
      <TrueFalse config={{ id: "x", type: "true-false", content: { statements: [] } } as never} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TrueFalse config={config} resetKey={1} />);
    await user.click(screen.getByRole("button", { name: /Mark as true/ }));
    expect(await screen.findByText("Correct")).toBeInTheDocument();
    rerender(<TrueFalse config={config} resetKey={2} />);
    await waitFor(() => expect(screen.queryByText("Correct")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Mark as true/ })).toBeEnabled();
    expect(screen.getByText("Statement 1 of 3")).toBeInTheDocument();
  });
});
