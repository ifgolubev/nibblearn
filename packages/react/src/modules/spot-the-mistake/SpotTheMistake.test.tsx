import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpotTheMistake } from "./SpotTheMistake";
import { spotTheMistakeSchema } from "@nibblearn/core";

const base = {
  id: "stm",
  type: "spot-the-mistake",
  title: "Campaign review",
  content: {
    canvas: {
      kind: "document",
      title: "Campaign setup",
      subtitle: "Review before launch",
      rows: [
        { id: "name", label: "Campaign name", value: "Spring Launch", section: "Basics" },
        { id: "budget", label: "Daily budget", value: "250.00", section: "Budget" },
        {
          id: "currency",
          label: "Currency",
          value: "USD",
          section: "Budget",
          note: "Account currency: EUR",
        },
        { id: "start", label: "Start date", value: "2026-04-01", section: "Schedule" },
        { id: "end", label: "End date", value: "2026-03-15", section: "Schedule" },
      ],
    },
    mistakes: [
      {
        targetId: "currency",
        title: "Wrong currency",
        explanation: "The account bills in EUR.",
        hint: "Check the money.",
      },
      {
        targetId: "end",
        title: "Ends before it starts",
        explanation: "End date precedes the start date.",
      },
    ],
    summary: "Two issues would have blocked launch.",
  },
} as const;

const instantConfig = spotTheMistakeSchema.parse(base);
const submitConfig = spotTheMistakeSchema.parse({ ...base, behavior: { checkMode: "submit" } });

describe("SpotTheMistake (instant)", () => {
  it("gives instant verdicts, counts wrong picks and completes with a penalised score", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<SpotTheMistake config={instantConfig} onComplete={onComplete} />);

    expect(screen.getByRole("heading", { name: "Campaign review" })).toBeInTheDocument();
    expect(screen.getByText("Find 2 mistakes.")).toBeInTheDocument();
    expect(screen.getByText("0 of 2 found")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Campaign setup" })).toBeInTheDocument();

    // A wrong pick.
    await user.click(screen.getByRole("button", { name: /^Select\s?Campaign name/ }));
    expect(await screen.findByText("That part is fine.")).toBeInTheDocument();
    expect(screen.getByText("1 wrong picks")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Select\s?Campaign name/ })).toHaveAttribute(
      "data-state",
      "wrong",
    );

    // A real mistake.
    await user.click(screen.getByRole("button", { name: /^Select\s?Currency/ }));
    expect(await screen.findByText("Mistake found! Wrong currency")).toBeInTheDocument();
    expect(screen.getByText("The account bills in EUR.")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Select\s?Currency/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /^Select\s?End date/ }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0]![0];
    expect(result.correct).toBe(2);
    expect(result.total).toBe(2);
    expect(result.score).toBeCloseTo(0.85);
    expect(await screen.findByText("You found all the mistakes!")).toBeInTheDocument();
    expect(screen.getByText("Two issues would have blocked launch.")).toBeInTheDocument();
    const list = screen.getByRole("region", { name: "Mistakes" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("cycles hints and reveals remaining mistakes after two wrong picks", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<SpotTheMistake config={instantConfig} onComplete={onComplete} onEvent={onEvent} />);

    await user.click(screen.getByRole("button", { name: "Show hint" }));
    expect(screen.getByRole("note")).toHaveTextContent("Check the money.");
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:hint");
    await user.click(screen.getByRole("button", { name: "Show hint" }));
    // Second mistake has no hint text: the section is highlighted instead.
    expect(screen.getByRole("note")).toHaveTextContent("Look closer at the highlighted area.");
    expect(screen.getByRole("region", { name: "Schedule" })).toHaveAttribute("data-hinted", "true");

    expect(screen.queryByRole("button", { name: "Reveal remaining" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Select\s?Campaign name/ }));
    await user.click(screen.getByRole("button", { name: /^Select\s?Daily budget/ }));
    await user.click(await screen.findByRole("button", { name: "Reveal remaining" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0].score).toBe(0);
    expect(onComplete.mock.calls[0]![0].details.revealed).toBe(true);
    expect(screen.getByRole("button", { name: /^Select\s?Currency/ })).toHaveAttribute(
      "data-state",
      "missed",
    );
    expect(await screen.findByText("Keep going!")).toBeInTheDocument();
  });

  it("ends the module when maxWrong is exceeded", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const cfg = spotTheMistakeSchema.parse({ ...base, behavior: { maxWrong: 1 } });
    render(<SpotTheMistake config={cfg} onComplete={onComplete} />);
    await user.click(screen.getByRole("button", { name: /^Select\s?Campaign name/ }));
    expect(onComplete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /^Select\s?Daily budget/ }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /^Select\s?End date/ })).toHaveAttribute(
      "data-state",
      "missed",
    );
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SpotTheMistake config={instantConfig} resetKey={1} />);
    await user.click(screen.getByRole("button", { name: /^Select\s?Currency/ }));
    expect(screen.getByText("1 of 2 found")).toBeInTheDocument();
    rerender(<SpotTheMistake config={instantConfig} resetKey={2} />);
    await waitFor(() => expect(screen.getByText("0 of 2 found")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^Select\s?Currency/ })).toBeEnabled();
  });

  it("renders an error state for invalid config", () => {
    render(
      <SpotTheMistake
        config={
          {
            ...base,
            content: { ...base.content, mistakes: [{ targetId: "nope", explanation: "x" }] },
          } as never
        }
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });
});

describe("SpotTheMistake (submit)", () => {
  it("toggles selections and evaluates them on Submit", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<SpotTheMistake config={submitConfig} onComplete={onComplete} />);
    const submit = screen.getByRole("button", { name: "Submit" });
    expect(submit).toBeDisabled();

    const currency = screen.getByRole("button", { name: /^Select\s?Currency/ });
    await user.click(currency);
    expect(currency).toHaveAttribute("aria-pressed", "true");
    await user.click(currency);
    expect(currency).toHaveAttribute("aria-pressed", "false");

    await user.click(currency);
    await user.click(screen.getByRole("button", { name: /^Select\s?Campaign name/ }));
    await user.click(submit);
    expect(
      await screen.findByText("1 of 2 found", { selector: ".nb-feedback__title" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Select\s?Campaign name/ })).toHaveAttribute(
      "data-state",
      "wrong",
    );
    expect(onComplete).not.toHaveBeenCalled();

    // Keyboard: focus a row and press Enter to select, then submit.
    screen.getByRole("button", { name: /^Select\s?End date/ }).focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0].score).toBeCloseTo(0.85);
  });
});
