import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { labelDiagramSchema } from "@nibblearn/core";
import { LabelDiagram } from "./LabelDiagram";

const config = labelDiagramSchema.parse({
  id: "ad",
  type: "label-diagram",
  title: "Anatomy of an ad",
  content: {
    image: { src: "ad.svg", alt: "An ad", width: 1200, height: 700 },
    targets: [
      { id: "logo", x: 10, y: 10, label: "Logo", explanation: "Who is talking." },
      { id: "cta", x: 80, y: 70, label: "Call to action" },
      { id: "legal", x: 50, y: 95, label: "Disclaimer" },
    ],
    distractors: ["Tracking pixel"],
    explanation: "Pixels are invisible.",
  },
  behavior: { shuffle: false },
});

const tray = () => screen.getByRole("region", { name: "Labels" });
const chip = (name: string) => within(tray()).getByRole("button", { name });
const zone = (index: number) => screen.getByRole("button", { name: new RegExp(`^Zone ${index}:`) });

type User = ReturnType<typeof userEvent.setup>;
async function placeAll(user: User, map: Record<string, number>) {
  for (const [label, index] of Object.entries(map)) {
    await user.click(chip(label));
    await user.click(zone(index));
  }
}

describe("LabelDiagram", () => {
  it("places labels by tap, checks and completes with full credit", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<LabelDiagram config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("heading", { name: "Anatomy of an ad" })).toBeInTheDocument();
    expect(within(tray()).getAllByRole("button")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
    expect(zone(1)).toHaveTextContent("Drop a label");

    await user.click(chip("Logo"));
    expect(chip("Logo")).toHaveAttribute("aria-pressed", "true");
    expect(zone(1)).toHaveTextContent("Place here");
    await user.click(zone(1));
    expect(zone(1)).toHaveAccessibleName("Zone 1: Logo");
    expect(within(tray()).queryByRole("button", { name: "Logo" })).not.toBeInTheDocument();
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:interact");

    // Tapping a filled zone returns its label to the tray.
    await user.click(zone(1));
    expect(chip("Logo")).toBeInTheDocument();
    expect(zone(1)).toHaveTextContent("Drop a label");

    await placeAll(user, { Logo: 1, "Call to action": 2, Disclaimer: 3 });
    expect(screen.getAllByText("Tracking pixel").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Every label is in the right place!")).toBeInTheDocument();
    expect(zone(2)).toHaveAttribute("data-state", "correct");
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0]).toMatchObject({ score: 1, correct: 3, total: 3 });
    expect(screen.getByText("What each part does")).toBeInTheDocument();
    expect(screen.getByText("Who is talking.")).toBeInTheDocument();
    expect(screen.getByText("Pixels are invisible.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("marks wrong zones, keeps correct ones locked on retry and decays the score", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<LabelDiagram config={config} onComplete={onComplete} />);

    await placeAll(user, { "Tracking pixel": 1, "Call to action": 2, Disclaimer: 3 });
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Not quite")).toBeInTheDocument();
    expect(zone(1)).toHaveAttribute("data-state", "incorrect");
    expect(within(zone(1)).getByRole("img", { name: "Not quite" })).toBeInTheDocument();
    expect(zone(2)).toHaveAttribute("data-state", "correct");
    // The right label is not given away while retries remain.
    expect(screen.queryByText("Correct: Logo")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByText("Not quite")).not.toBeInTheDocument());
    expect(chip("Tracking pixel")).toBeInTheDocument();
    expect(zone(2)).toHaveAttribute("data-state", "locked");
    expect(zone(2)).toHaveAttribute("aria-disabled", "true");
    await user.click(zone(2)); // locked: nothing happens
    expect(zone(2)).toHaveAccessibleName(/Call to action/);

    await placeAll(user, { Logo: 1 });
    await user.click(screen.getByRole("button", { name: "Check" }));
    await user.click(await screen.findByRole("button", { name: "Finish" }));
    expect(onComplete.mock.calls[0]![0].score).toBe(0.75);
  });

  it("shows the right labels when attempts run out", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(
      <LabelDiagram
        config={{ ...config, behavior: { ...config.behavior, maxAttempts: 1 } }}
        onComplete={onComplete}
      />,
    );
    await placeAll(user, { "Call to action": 1, Logo: 2, Disclaimer: 3 });
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Correct: Logo")).toBeInTheDocument();
    expect(screen.getByText("Correct: Call to action")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(onComplete.mock.calls[0]![0].score).toBeCloseTo(1 / 3);
    expect(onComplete.mock.calls[0]![0].details.revealed).toBe(true);
  });

  it("is operable with the keyboard", async () => {
    const user = userEvent.setup();
    render(<LabelDiagram config={config} />);
    chip("Disclaimer").focus();
    await user.keyboard("{Enter}");
    expect(chip("Disclaimer")).toHaveAttribute("aria-pressed", "true");
    zone(3).focus();
    await user.keyboard("{Enter}");
    expect(zone(3)).toHaveAccessibleName("Zone 3: Disclaimer");
    expect(screen.getAllByText("2 zones to fill").length).toBeGreaterThan(0);
    // Selecting a label and choosing a filled zone swaps it in.
    chip("Logo").focus();
    await user.keyboard(" ");
    zone(3).focus();
    await user.keyboard(" ");
    expect(zone(3)).toHaveAccessibleName("Zone 3: Logo");
    expect(chip("Disclaimer")).toBeInTheDocument();
  });

  it("renders an error state for invalid config", () => {
    render(
      <LabelDiagram
        config={
          {
            id: "x",
            type: "label-diagram",
            content: {
              image: { src: "a.svg" },
              targets: [
                { id: "a", x: 1, y: 1, label: "Same" },
                { id: "b", x: 2, y: 2, label: "same" },
              ],
            },
          } as never
        }
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LabelDiagram config={config} resetKey={1} />);
    await placeAll(user, { Logo: 1 });
    expect(zone(1)).toHaveAccessibleName("Zone 1: Logo");
    rerender(<LabelDiagram config={config} resetKey={2} />);
    await waitFor(() => expect(zone(1)).toHaveTextContent("Drop a label"));
    expect(chip("Logo")).toBeInTheDocument();
  });
});
