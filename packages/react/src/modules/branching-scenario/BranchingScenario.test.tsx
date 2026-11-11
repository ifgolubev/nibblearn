import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BranchingScenario } from "./BranchingScenario";
import { branchingScenarioSchema } from "@nibblearn/core";

const base = {
  id: "scn",
  type: "branching-scenario",
  title: "The unhappy client",
  content: {
    start: "call",
    nodes: [
      {
        id: "call",
        speaker: "Client",
        title: "The call",
        text: "The client says the campaign is underperforming.",
        choices: [
          {
            text: "Ask what success looks like",
            next: "listen",
            points: 3,
            quality: "good",
            feedback: "Good: you gathered context.",
          },
          {
            text: "Blame the creative",
            next: "blame",
            points: -2,
            quality: "poor",
            feedback: "Deflecting erodes trust.",
          },
          { text: "Promise a fix by Monday", next: "listen", points: 0, quality: "neutral" },
        ],
      },
      {
        id: "listen",
        text: "The client relaxes a little.",
        choices: [
          { text: "Propose a plan", next: "win", points: 2, quality: "good" },
          { text: "Go quiet", next: "lose", points: -1, quality: "poor" },
        ],
      },
      {
        id: "blame",
        kind: "ending",
        outcome: "failure",
        title: "Churned",
        text: "They walked.",
        summary: "Own the problem first.",
      },
      {
        id: "win",
        kind: "ending",
        outcome: "success",
        title: "Renewed",
        text: "They stay.",
        summary: "Listen, then act.",
      },
      {
        id: "lose",
        kind: "ending",
        outcome: "neutral",
        title: "On probation",
        text: "A second chance.",
      },
    ],
  },
} as const;

const config = branchingScenarioSchema.parse(base);
const withIntro = branchingScenarioSchema.parse({
  ...base,
  content: { ...base.content, intro: "A Tuesday morning at the agency." },
});

describe("BranchingScenario", () => {
  it("plays through to a success ending, shows history and completes once", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<BranchingScenario config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("heading", { name: "The unhappy client" })).toBeInTheDocument();
    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByText("What do you do?")).toBeInTheDocument();
    const cont = screen.getByRole("button", { name: "Continue" });
    expect(cont).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /Ask what success/ }));
    expect(screen.getByRole("radio", { name: /Ask what success/ })).toHaveAttribute(
      "data-state",
      "selected",
    );
    await user.click(cont);
    expect(await screen.findByText("Good: you gathered context.")).toBeInTheDocument();
    expect(screen.getByText("+3 points")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("The client relaxes a little.")).toBeInTheDocument();
    const history = screen.getByRole("list", { name: "Your decisions" });
    expect(history).toHaveTextContent("Decision 1");
    expect(history).toHaveTextContent("Ask what success looks like");

    await user.click(screen.getByRole("radio", { name: /Propose a plan/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("+2 points")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Great outcome")).toBeInTheDocument();
    expect(screen.getByText("Renewed")).toBeInTheDocument();
    expect(screen.getByText("Listen, then act.")).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0]![0];
    expect(result.score).toBe(1);
    expect(result.details.ending).toBe("win");
    expect(result.details.outcome).toBe("success");
    expect(result.details.points).toBe(5);
    expect(result.details.path).toEqual([
      { nodeId: "call", choiceIndex: 0 },
      { nodeId: "listen", choiceIndex: 0 },
    ]);
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:complete");
    expect(screen.getByRole("button", { name: "Explore another path" })).toBeInTheDocument();
  });

  it("reaches a failure ending, then explores another path (reset)", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<BranchingScenario config={config} onComplete={onComplete} onEvent={onEvent} />);

    await user.click(screen.getByRole("radio", { name: /Blame the creative/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Deflecting erodes trust.")).toBeInTheDocument();
    expect(screen.getByText("-2 points")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Poor outcome")).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0].score).toBe(0);

    await user.click(screen.getByRole("button", { name: "Explore another path" }));
    expect(
      await screen.findByText("The client says the campaign is underperforming."),
    ).toBeInTheDocument();
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:reset");
    expect(screen.queryByRole("list", { name: "Your decisions" })).not.toBeInTheDocument();
  });

  it("advances immediately when a choice has no feedback or points", async () => {
    const user = userEvent.setup();
    render(<BranchingScenario config={config} />);
    await user.click(screen.getByRole("radio", { name: /Promise a fix/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("The client relaxes a little.")).toBeInTheDocument();
  });

  it("shows an intro with a Start button when provided", async () => {
    const user = userEvent.setup();
    render(<BranchingScenario config={withIntro} />);
    expect(screen.getByText("A Tuesday morning at the agency.")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(await screen.findByRole("radio", { name: /Ask what success/ })).toBeInTheDocument();
  });

  it("supports keyboard: letters select, Enter confirms and continues", async () => {
    const user = userEvent.setup();
    render(<BranchingScenario config={config} />);
    screen.getByRole("radio", { name: /Blame/ }).focus();
    await user.keyboard("a");
    expect(screen.getByRole("radio", { name: /Ask what success/ })).toHaveAttribute(
      "data-state",
      "selected",
    );
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Good: you gathered context.")).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("The client relaxes a little.")).toBeInTheDocument();
  });

  it("hides score and points when showScore is false", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const cfg = branchingScenarioSchema.parse({ ...base, behavior: { showScore: false } });
    render(<BranchingScenario config={cfg} onComplete={onComplete} />);
    await user.click(screen.getByRole("radio", { name: /Ask what success/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Good: you gathered context.")).toBeInTheDocument();
    expect(screen.queryByText("+3 points")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("radio", { name: /Propose a plan/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    // No points shown and no feedback: advances straight to the ending.
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete.mock.calls[0]![0].score).toBeUndefined();
  });

  it("hides the retry action when allowRetry is false", async () => {
    const user = userEvent.setup();
    const cfg = branchingScenarioSchema.parse({ ...base, behavior: { allowRetry: false } });
    render(<BranchingScenario config={cfg} />);
    await user.click(screen.getByRole("radio", { name: /Blame/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Poor outcome")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Explore another path" })).not.toBeInTheDocument();
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<BranchingScenario config={config} resetKey={1} />);
    await user.click(screen.getByRole("radio", { name: /Promise a fix/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("The client relaxes a little.")).toBeInTheDocument();
    rerender(<BranchingScenario config={config} resetKey={2} />);
    expect(
      await screen.findByText("The client says the campaign is underperforming."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("The client relaxes a little.")).not.toBeInTheDocument(),
    );
  });

  it("renders an error state for invalid config", () => {
    render(
      <BranchingScenario
        config={
          { id: "x", type: "branching-scenario", content: { start: "nope", nodes: [] } } as never
        }
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });
});
