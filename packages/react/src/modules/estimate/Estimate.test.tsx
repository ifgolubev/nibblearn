import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { estimateSchema } from "@nibblearn/core";
import { Estimate } from "./Estimate";

const base = {
  id: "bench",
  type: "estimate",
  title: "Benchmark instincts",
  instructions: "Estimate each number.",
  content: {
    questions: [
      {
        id: "ctr",
        prompt: "What was the CTR?",
        context: "Clicks ÷ impressions.",
        min: 0,
        max: 0.1,
        step: 0.001,
        answer: 0.028,
        format: "percent",
        tolerance: 0.004,
        hint: "Low single digits.",
        explanation: "It was 2.8%.",
      },
      {
        id: "roas",
        prompt: "What was search ROAS?",
        min: 0,
        max: 10,
        step: 0.1,
        answer: 4.1,
        unit: "×",
        tolerance: 0.3,
        explanation: "Search returned 4.1×.",
      },
    ],
  },
} as const;

const config = estimateSchema.parse(base);

function slider() {
  return screen.getByRole("slider", { name: "Your estimate" });
}

describe("Estimate", () => {
  it("renders the first question with a centred guess, scale and exact input", () => {
    render(<Estimate config={config} />);
    expect(screen.getByRole("heading", { name: "Benchmark instincts" })).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What was the CTR?" })).toBeInTheDocument();
    expect(slider()).toHaveAttribute("aria-valuetext", "5%");
    expect(slider()).toHaveAccessibleDescription("What was the CTR?");
    expect(screen.getByRole("spinbutton", { name: "Exact value" })).toHaveValue(5);
    expect(screen.getByText("From 0% to 10%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lock in" })).toBeEnabled();
  });

  it("moves the guess with the slider, buttons and exact input", async () => {
    const user = userEvent.setup();
    render(<Estimate config={config} />);
    fireEvent.change(slider(), { target: { value: "0.031" } });
    expect(slider()).toHaveAttribute("aria-valuetext", "3.1%");
    expect(screen.getByRole("spinbutton", { name: "Exact value" })).toHaveValue(3.1);
    await user.click(screen.getByRole("button", { name: "Increase estimate" }));
    expect(slider()).toHaveAttribute("aria-valuetext", "3.2%");
    await user.click(screen.getByRole("button", { name: "Decrease estimate" }));
    await user.click(screen.getByRole("button", { name: "Decrease estimate" }));
    expect(slider()).toHaveAttribute("aria-valuetext", "3%");

    const input = screen.getByRole("spinbutton", { name: "Exact value" });
    await user.clear(input);
    await user.type(input, "2.6");
    expect(slider()).toHaveAttribute("aria-valuetext", "2.6%");
    // Out-of-range entries clamp on blur.
    await user.clear(input);
    await user.type(input, "40");
    await user.tab();
    expect(input).toHaveValue(10);
    expect(slider()).toHaveAttribute("aria-valuetext", "10%");
  });

  it("locks in, reveals the answer with a band verdict and delta, then advances", async () => {
    const user = userEvent.setup();
    const onEvent = vi.fn();
    render(<Estimate config={config} onEvent={onEvent} />);
    fireEvent.change(slider(), { target: { value: "0.032" } });
    await user.click(screen.getByRole("button", { name: "Lock in" }));

    expect(await screen.findByText("Bullseye!")).toBeInTheDocument();
    expect(screen.getByText(/You were 0\.4\s+pp too high\./)).toBeInTheDocument();
    expect(
      screen.getByText(/The answer is 2\.8%\./, { selector: ".nb-est__delta" }),
    ).toBeInTheDocument();
    expect(screen.getByText("It was 2.8%.")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    const answer = onEvent.mock.calls.find((c) => c[0].type === "module:answer")![0];
    expect(answer.payload).toMatchObject({
      questionIndex: 0,
      guess: 0.032,
      band: "bullseye",
      score: 1,
    });

    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toHaveFocus();
    await user.click(next);
    expect(await screen.findByText("Question 2 of 2")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "What was search ROAS?" }),
    ).toBeInTheDocument();
    expect(slider()).toHaveAttribute("aria-valuetext", "5×");
  });

  it("classifies close and way-off guesses without colour alone", async () => {
    const user = userEvent.setup();
    render(<Estimate config={config} />);
    fireEvent.change(slider(), { target: { value: "0.038" } });
    await user.click(screen.getByRole("button", { name: "Lock in" }));
    expect(await screen.findByText("Close")).toBeInTheDocument();
    expect(screen.getByText(/You were 1\s+pp too high\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "What was search ROAS?" });
    fireEvent.change(slider(), { target: { value: "9" } });
    await user.click(screen.getByRole("button", { name: "Lock in" }));
    expect(await screen.findByText("Way off")).toBeInTheDocument();
    expect(screen.getByText(/You were 4\.9× too high\./)).toBeInTheDocument();
  });

  it("is keyboard operable: Enter locks in and advances", async () => {
    const user = userEvent.setup();
    render(<Estimate config={config} />);
    slider().focus();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByText(/The answer is 2\.8%\./, { selector: ".nb-est__delta" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("heading", { name: "What was search ROAS?" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(slider()).toHaveFocus());

    // Enter inside the exact input commits the typed value and locks in.
    const input = screen.getByRole("spinbutton", { name: "Exact value" });
    await user.clear(input);
    await user.type(input, "4.2{Enter}");
    expect(await screen.findByText("Bullseye!")).toBeInTheDocument();
    expect(screen.getByText(/You were 0\.1× too high\./)).toBeInTheDocument();
  });

  it("completes with a summary, an average accuracy score and retry", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<Estimate config={config} onComplete={onComplete} onEvent={onEvent} />);
    // Q1 exact; Q2 close (5 vs 4.1: 0.9 away = 3 × tolerance 0.3; score 1 − 0.6 / 2.7)
    fireEvent.change(slider(), { target: { value: "0.028" } });
    await user.click(screen.getByRole("button", { name: "Lock in" }));
    expect(await screen.findByText(/Spot on\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "What was search ROAS?" });
    await user.click(screen.getByRole("button", { name: "Lock in" }));
    await user.click(await screen.findByRole("button", { name: "Finish" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const result = onComplete.mock.calls[0]![0];
    const q2 = 1 - 0.6 / 2.7;
    expect(result.score).toBeCloseTo((1 + q2) / 2, 3);
    expect(result.correct).toBe(1);
    expect(result.total).toBe(2);
    expect(result.details.answers).toHaveLength(2);

    expect(await screen.findByText("Average accuracy")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("You: 2.8% · Answer: 2.8%")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Bullseye!" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Close" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Question 1 of 2")).toBeInTheDocument();
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:reset");
  });

  it("emits a hint event", async () => {
    const user = userEvent.setup();
    const onEvent = vi.fn();
    render(<Estimate config={config} onEvent={onEvent} />);
    await user.click(screen.getByRole("button", { name: "Show hint" }));
    expect(screen.getByText("Low single digits.")).toBeInTheDocument();
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:hint");
  });

  it("hides the counter for a single question and formats currency", () => {
    const cfg = estimateSchema.parse({
      ...base,
      content: {
        currency: "EUR",
        questions: [
          { prompt: "CPA?", min: 5, max: 60, step: 0.1, answer: 21.4, format: "currency" },
        ],
      },
    });
    render(<Estimate config={cfg} />);
    expect(screen.queryByText(/Question 1 of/)).not.toBeInTheDocument();
    expect(slider()).toHaveAttribute("aria-valuetext", "€32.50");
    expect(screen.getByText("From €5.00 to €60.00")).toBeInTheDocument();
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Estimate config={config} resetKey={1} />);
    await user.click(screen.getByRole("button", { name: "Lock in" }));
    expect(
      await screen.findByText(/The answer is/, { selector: ".nb-est__delta" }),
    ).toBeInTheDocument();
    rerender(<Estimate config={config} resetKey={2} />);
    await waitFor(() =>
      expect(
        screen.queryByText(/The answer is/, { selector: ".nb-est__delta" }),
      ).not.toBeInTheDocument(),
    );
    expect(slider()).toHaveAttribute("aria-valuetext", "5%");
  });

  it("renders an error state for invalid config", () => {
    render(
      <Estimate
        config={
          {
            id: "x",
            type: "estimate",
            content: { questions: [{ prompt: "?", min: 0, max: 10, answer: 20 }] },
          } as never
        }
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/answer must be within/);
  });
});
