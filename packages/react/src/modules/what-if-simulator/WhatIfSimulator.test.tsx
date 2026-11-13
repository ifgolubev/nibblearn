import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { whatIfSimulatorSchema } from "@nibblearn/core";
import { WhatIfSimulator } from "./WhatIfSimulator";

const base = {
  id: "sim",
  type: "what-if-simulator",
  title: "Acquisition cost explorer",
  content: {
    inputs: [
      {
        id: "spend",
        label: "Spend",
        min: 1000,
        max: 50000,
        step: 500,
        default: 10000,
        format: "currency",
        help: "Monthly budget.",
      },
      { id: "cpc", label: "CPC", min: 0.2, max: 8, step: 0.1, default: 1.5, format: "currency" },
      {
        id: "cvr",
        label: "Conversion rate",
        min: 0.005,
        max: 0.1,
        step: 0.005,
        default: 0.02,
        format: "percent",
      },
    ],
    outputs: [
      { id: "clicks", label: "Clicks", formula: "floor(spend / cpc)", format: "integer" },
      {
        id: "conversions",
        label: "Conversions",
        formula: "floor(clicks * cvr)",
        format: "integer",
      },
      {
        id: "cpa",
        label: "CPA",
        formula: "spend / max(conversions, 1)",
        format: "currency",
        primary: true,
        help: "Cost per customer.",
      },
    ],
    insights: [
      { id: "expensive", when: "cpa > 50", tone: "warning", text: "Customers are expensive." },
      { id: "cheap", when: "cpa < 30", tone: "success", text: "Great efficiency." },
    ],
  },
} as const;

const withChallenge = whatIfSimulatorSchema.parse({
  ...base,
  content: {
    ...base.content,
    challenge: {
      description: "Get CPA under $30 with spend ≥ $10,000.",
      goal: "cpa < 30 and spend >= 10000",
      successMessage: "Profitable mix found.",
    },
  },
});

const noChallenge = whatIfSimulatorSchema.parse(base);

function slider(name: RegExp | string) {
  return screen.getByRole("slider", { name });
}

describe("WhatIfSimulator", () => {
  it("renders inputs, outputs, chart table and the illustrative note", () => {
    render(<WhatIfSimulator config={withChallenge} />);
    expect(screen.getByRole("heading", { name: "Acquisition cost explorer" })).toBeInTheDocument();
    expect(screen.getAllByRole("slider")).toHaveLength(3);
    expect(slider("Spend")).toHaveAttribute("aria-valuetext", "$10,000");
    expect(slider("Conversion rate")).toHaveAttribute("aria-valuetext", "2%");
    expect(screen.getByText("Monthly budget.")).toBeInTheDocument();
    // Defaults: 6666 clicks, 133 conversions, CPA = 10000 / 133 ≈ 75.19
    expect(screen.getAllByText("$75.19").length).toBeGreaterThan(0);
    const table = screen.getByRole("table", { name: "Results" });
    expect(within(table).getByRole("row", { name: /Clicks 6,666/ })).toBeInTheDocument();
    expect(screen.getByText("Figures are illustrative.")).toBeInTheDocument();
    expect(screen.getByText("Customers are expensive.")).toBeInTheDocument();
    expect(screen.queryByText("Great efficiency.")).not.toBeInTheDocument();
    expect(screen.getByText("Not yet — keep adjusting.")).toBeInTheDocument();
  });

  it("recomputes outputs, swaps insights and completes the challenge when the goal is met", async () => {
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<WhatIfSimulator config={withChallenge} onComplete={onComplete} onEvent={onEvent} />);

    fireEvent.change(slider("Conversion rate"), { target: { value: "0.06" } });
    // clicks 6666 → conversions 399 → CPA 25.06 → "$25.06"
    expect(slider("Conversion rate")).toHaveAttribute("aria-valuetext", "6%");
    await waitFor(() => expect(screen.getAllByText("$25.06").length).toBeGreaterThan(0));
    expect(screen.getByText("Great efficiency.")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("Customers are expensive.")).not.toBeInTheDocument(),
    );

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const result = onComplete.mock.calls[0]![0];
    expect(result.score).toBe(1);
    expect(result.details.inputs).toEqual({ spend: 10000, cpc: 1.5, cvr: 0.06 });
    expect(await screen.findByText("Profitable mix found.")).toBeInTheDocument();
    expect(screen.getAllByText("Challenge complete!").length).toBeGreaterThan(0);

    await waitFor(() =>
      expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:interact"),
    );
    const interact = onEvent.mock.calls.find((c) => c[0].type === "module:interact")![0];
    expect(interact.payload.inputs).toEqual({ spend: 10000, cpc: 1.5, cvr: 0.06 });

    // Reset to defaults keeps the completion but restores the inputs.
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Reset to defaults" }));
    expect(slider("Conversion rate")).toHaveAttribute("aria-valuetext", "2%");
    expect(screen.getByText("Profitable mix found.")).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("steps with the +/- buttons and keyboard, clamping at the bounds", async () => {
    const user = userEvent.setup();
    render(<WhatIfSimulator config={withChallenge} />);
    const cpc = slider("CPC");
    await user.click(screen.getByRole("button", { name: "Increase CPC" }));
    expect(cpc).toHaveValue("1.6");
    await user.click(screen.getByRole("button", { name: "Decrease CPC" }));
    await user.click(screen.getByRole("button", { name: "Decrease CPC" }));
    expect(cpc).toHaveValue("1.4");

    const spend = slider("Spend");
    fireEvent.change(spend, { target: { value: "50000" } });
    expect(screen.getByRole("button", { name: "Increase Spend" })).toBeDisabled();
    expect(spend).toHaveValue("50000");

    // Step buttons are keyboard operable (native arrow keys on the range are not emulated by jsdom).
    screen.getByRole("button", { name: "Decrease Spend" }).focus();
    await user.keyboard("{Enter}");
    expect(spend).toHaveValue("49500");
    expect(screen.getByRole("button", { name: "Increase Spend" })).toBeEnabled();
  });

  it("completes on first interaction (no score) when there is no challenge and keeps the simulator visible", async () => {
    const onComplete = vi.fn();
    render(<WhatIfSimulator config={noChallenge} onComplete={onComplete} />);
    expect(screen.queryByText("Challenge")).not.toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.change(slider("Spend"), { target: { value: "20000" } });
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(onComplete.mock.calls[0]![0].score).toBeUndefined();
    expect(await screen.findByText("Nice work")).toBeInTheDocument();
    // Still explorable.
    expect(screen.getAllByRole("slider")).toHaveLength(3);
    fireEvent.change(slider("Spend"), { target: { value: "30000" } });
    expect(slider("Spend")).toHaveAttribute("aria-valuetext", "$30,000");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("does not auto-complete when completeOnInteract is off", async () => {
    const onComplete = vi.fn();
    const cfg = whatIfSimulatorSchema.parse({
      ...base,
      behavior: { chart: "none", completeOnInteract: false },
    });
    render(<WhatIfSimulator config={cfg} onComplete={onComplete} />);
    fireEvent.change(slider("Spend"), { target: { value: "20000" } });
    await new Promise((r) => setTimeout(r, 800));
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows '—' for non-finite outputs", () => {
    const cfg = whatIfSimulatorSchema.parse({
      ...base,
      content: {
        ...base.content,
        inputs: [{ id: "x", label: "X", min: 0, max: 10, step: 1, default: 0 }],
        outputs: [{ id: "ratio", label: "Ratio", formula: "1 / x", primary: true }],
        insights: [],
      },
    });
    render(<WhatIfSimulator config={cfg} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("resets when resetKey changes", async () => {
    const { rerender } = render(<WhatIfSimulator config={withChallenge} resetKey={1} />);
    fireEvent.change(slider("Conversion rate"), { target: { value: "0.06" } });
    expect(await screen.findByText("Profitable mix found.")).toBeInTheDocument();
    rerender(<WhatIfSimulator config={withChallenge} resetKey={2} />);
    await waitFor(() =>
      expect(screen.queryByText("Profitable mix found.")).not.toBeInTheDocument(),
    );
    expect(slider("Conversion rate")).toHaveAttribute("aria-valuetext", "2%");
    expect(screen.getByText("Not yet — keep adjusting.")).toBeInTheDocument();
  });

  it("retries from the completion card", async () => {
    const user = userEvent.setup();
    const onEvent = vi.fn();
    render(<WhatIfSimulator config={withChallenge} onEvent={onEvent} />);
    fireEvent.change(slider("Conversion rate"), { target: { value: "0.06" } });
    await screen.findByText("Profitable mix found.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(screen.queryByText("Profitable mix found.")).not.toBeInTheDocument(),
    );
    expect(slider("Conversion rate")).toHaveAttribute("aria-valuetext", "2%");
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:reset");
  });

  it("renders an error state for invalid config", () => {
    render(
      <WhatIfSimulator
        config={
          {
            id: "x",
            type: "what-if-simulator",
            content: { inputs: [], outputs: [{ id: "a", label: "A", formula: "1 +" }] },
          } as never
        }
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });
});
