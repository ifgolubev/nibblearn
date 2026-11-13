import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScreenshotWalkthrough } from "./ScreenshotWalkthrough";
import { screenshotWalkthroughSchema } from "@nibblearn/core";

const img = {
  src: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%2F%3E",
  alt: "CRM",
  width: 1200,
  height: 760,
};

const config = screenshotWalkthroughSchema.parse({
  id: "walk",
  type: "screenshot-walkthrough",
  title: "Find the call note",
  content: {
    steps: [
      {
        id: "s1",
        image: img,
        title: "Open contacts",
        instruction: "Click **Contacts** in the sidebar.",
        target: { x: 1, y: 18, width: 16, height: 5 },
        action: "click",
      },
      {
        id: "s2",
        image: img,
        instruction: "Type Maya into the search box.",
        target: { x: 33, y: 1, width: 33, height: 5 },
        action: "type",
        input: { placeholder: "Search", expected: "Maya" },
      },
      {
        id: "s3",
        image: img,
        instruction: "Review the last call note.",
        target: { x: 22, y: 60, width: 70, height: 12 },
        action: "observe",
      },
    ],
    summary: "You found it.",
  },
  behavior: { autoHintAfterMisses: 2 },
});

describe("ScreenshotWalkthrough", () => {
  it("guides through click, type and observe steps and completes with a score", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<ScreenshotWalkthrough config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("heading", { name: "Find the call note" })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();

    // Step 1: click the target region.
    await user.click(screen.getByRole("button", { name: "Click Contacts in the sidebar." }));
    expect(await screen.findByText("Step 2 of 3")).toBeInTheDocument();

    // Step 2: wrong text first, then the expected text via Enter.
    const input = screen.getByRole("textbox", { name: "Simulated input" });
    expect(input).toHaveAttribute("placeholder", "Search");
    await user.type(input, "Tomas{Enter}");
    expect(await screen.findByText("That's not quite it. Try: Maya")).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "maya{Enter}");
    expect(await screen.findByText("Step 3 of 3")).toBeInTheDocument();

    // Step 3: observe → Finish.
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0]![0];
    expect(result.score).toBeCloseTo(0.9);
    expect(result.details).toEqual({ misses: 1, steps: 3 });
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:complete");
    expect(await screen.findByText("Walkthrough complete")).toBeInTheDocument();
    expect(screen.getByText("You found it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("counts misses, offers Show me after a miss and auto-highlights after repeated misses", async () => {
    const user = userEvent.setup();
    const onEvent = vi.fn();
    const { container } = render(<ScreenshotWalkthrough config={config} onEvent={onEvent} />);
    const canvas = container.querySelector(".nb-walk__canvas")!;
    const target = screen.getByRole("button", { name: "Click Contacts in the sidebar." });

    fireEvent.click(canvas, { clientX: 0, clientY: 0 });
    expect(await screen.findByText("Not there — try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show me" })).toBeInTheDocument();
    expect(target).toHaveAttribute("data-hint", "false");

    fireEvent.click(canvas, { clientX: 0, clientY: 0 });
    await waitFor(() => expect(target).toHaveAttribute("data-hint", "true"));
    expect(screen.queryByRole("button", { name: "Show me" })).not.toBeInTheDocument();
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:hint");

    await user.click(target);
    expect(await screen.findByText("Step 2 of 3")).toBeInTheDocument();
  });

  it("is keyboard operable: Tab to the target, Enter to activate, Back/Next revisit completed steps", async () => {
    const user = userEvent.setup();
    render(<ScreenshotWalkthrough config={config} />);
    const target = screen.getByRole("button", { name: "Click Contacts in the sidebar." });
    target.focus();
    expect(target).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Step 2 of 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("Step 1 of 3")).toBeInTheDocument();
    // The completed step can be skipped with Next.
    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeEnabled();
    await user.click(next);
    expect(await screen.findByText("Step 2 of 3")).toBeInTheDocument();
  });

  it("renders an error state for invalid config", () => {
    render(
      <ScreenshotWalkthrough
        config={{ id: "x", type: "screenshot-walkthrough", content: { steps: [] } } as never}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ScreenshotWalkthrough config={config} resetKey={1} />);
    await user.click(screen.getByRole("button", { name: "Click Contacts in the sidebar." }));
    expect(await screen.findByText("Step 2 of 3")).toBeInTheDocument();
    rerender(<ScreenshotWalkthrough config={config} resetKey={2} />);
    await waitFor(() => expect(screen.getByText("Step 1 of 3")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
