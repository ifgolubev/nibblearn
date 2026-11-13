import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProcessExplorer } from "./ProcessExplorer";
import { processExplorerSchema } from "@nibblearn/core";

const base = {
  id: "proc",
  type: "process-explorer",
  title: "Campaign lifecycle",
  content: {
    stages: [
      {
        id: "brief",
        title: "Client brief",
        details: "Agree goals.",
        icon: "clipboard-list",
        owner: "Account team",
        duration: "1 day",
        checklist: ["Objective agreed", "Budget confirmed"],
      },
      {
        id: "creative",
        title: "Creative",
        details: "Make assets.",
        icon: "palette",
        dependsOn: ["brief"],
        branches: [{ label: "Back to brief", to: "brief" }],
      },
      {
        id: "launch",
        title: "Launch",
        details: "Go live.",
        icon: "not-a-real-icon",
        dependsOn: ["creative"],
      },
    ],
  },
} as const;

const config = processExplorerSchema.parse(base);

describe("ProcessExplorer", () => {
  it("renders stages, opens details, tracks progress and completes when all stages are visited", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<ProcessExplorer config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("heading", { name: "Campaign lifecycle" })).toBeInTheDocument();
    expect(screen.getByText("1 of 3 stages explored")).toBeInTheDocument();
    const stepper = screen.getByRole("list", { name: "Stages" });
    const nodes = within(stepper).getAllByRole("button");
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("heading", { level: 3, name: "Client brief" })).toBeInTheDocument();
    expect(screen.getByText("Objective agreed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finish" })).not.toBeInTheDocument();

    await user.click(nodes[1]!);
    expect(await screen.findByRole("heading", { level: 3, name: "Creative" })).toBeInTheDocument();
    expect(screen.getByText("2 of 3 stages explored")).toBeInTheDocument();
    expect(screen.getByText("Comes after")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Client brief" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back to brief/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next stage" }));
    expect(await screen.findByRole("heading", { level: 3, name: "Launch" })).toBeInTheDocument();
    expect(screen.getByText("3 of 3 stages explored")).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0].details).toEqual({
      visited: ["brief", "creative", "launch"],
    });
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:complete");

    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(await screen.findByText("You explored the whole process.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restart" }));
    expect(await screen.findByText("1 of 3 stages explored")).toBeInTheDocument();
  });

  it("jumps via branches and dependency chips", async () => {
    const user = userEvent.setup();
    render(<ProcessExplorer config={config} />);
    const nodes = within(screen.getByRole("list", { name: "Stages" })).getAllByRole("button");
    await user.click(nodes[2]!);
    expect(await screen.findByRole("heading", { level: 3, name: "Launch" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Creative" }));
    expect(await screen.findByRole("heading", { level: 3, name: "Creative" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Back to brief/ }));
    expect(
      await screen.findByRole("heading", { level: 3, name: "Client brief" }),
    ).toBeInTheDocument();
  });

  it("supports roving-tabindex keyboard navigation", async () => {
    const user = userEvent.setup();
    render(<ProcessExplorer config={config} />);
    const nodes = within(screen.getByRole("list", { name: "Stages" })).getAllByRole("button");
    expect(nodes[0]).toHaveAttribute("tabindex", "0");
    expect(nodes[1]).toHaveAttribute("tabindex", "-1");
    nodes[0]!.focus();
    await user.keyboard("{ArrowRight}");
    expect(nodes[1]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(nodes[2]).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { level: 3, name: "Launch" })).toBeInTheDocument();
    await user.keyboard("{Home}");
    expect(nodes[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(nodes[2]).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(nodes[1]).toHaveFocus();
    await user.keyboard(" ");
    expect(await screen.findByRole("heading", { level: 3, name: "Creative" })).toBeInTheDocument();
  });

  it("shows Finish after the first interaction when requireAll is false", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const cfg = processExplorerSchema.parse({
      ...base,
      behavior: { requireAll: false, layout: "vertical" },
    });
    const { container } = render(<ProcessExplorer config={cfg} onComplete={onComplete} />);
    expect(container.querySelector(".nb-process--vertical")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finish" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next stage" }));
    await user.click(await screen.findByRole("button", { name: "Finish" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0].details).toEqual({ visited: ["brief", "creative"] });
    expect(await screen.findByText("2/3")).toBeInTheDocument();
  });

  it("renders an error state for invalid config (unknown dependency)", () => {
    render(
      <ProcessExplorer
        config={
          {
            ...base,
            content: {
              stages: [
                { id: "a", title: "A", details: "x", dependsOn: ["missing"] },
                { id: "b", title: "B", details: "y" },
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
    const { rerender } = render(<ProcessExplorer config={config} resetKey={1} />);
    await user.click(screen.getByRole("button", { name: "Next stage" }));
    expect(await screen.findByText("2 of 3 stages explored")).toBeInTheDocument();
    rerender(<ProcessExplorer config={config} resetKey={2} />);
    await waitFor(() => expect(screen.getByText("1 of 3 stages explored")).toBeInTheDocument());
    expect(
      await screen.findByRole("heading", { level: 3, name: "Client brief" }),
    ).toBeInTheDocument();
  });
});

describe("ProcessExplorer hardening", () => {
  it("treats prototype-like icon names as unknown instead of crashing", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { processExplorerSchema } = await import("@nibblearn/core");
    const config = processExplorerSchema.parse({
      id: "p",
      type: "process-explorer",
      content: {
        stages: [
          { id: "a", title: "Alpha", details: "d", icon: "constructor" },
          { id: "b", title: "Beta", details: "d", icon: "toString" },
        ],
      },
    });
    render(<ProcessExplorer config={config} />);
    expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
  });
});
