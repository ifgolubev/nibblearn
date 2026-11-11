import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HotspotExplorer } from "./HotspotExplorer";
import { hotspotExplorerSchema } from "@nibblearn/core";

const base = {
  id: "hs",
  type: "hotspot-explorer",
  title: "Dashboard tour",
  content: {
    image: {
      src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>",
      alt: "Dashboard",
      width: 1200,
      height: 760,
    },
    hotspots: [
      {
        id: "kpi",
        x: 20,
        y: 30,
        label: "KPI cards",
        title: "Key metrics",
        description: "Spend, **ROAS** and more.",
      },
      { id: "chart", x: 70, y: 60, label: "Trend chart", description: "Daily spend over time." },
      {
        id: "table",
        x: 10,
        y: 80,
        width: 30,
        height: 15,
        shape: "rect",
        label: "Channel table",
        description: "Breakdown by channel.",
      },
    ],
  },
} as const;

const config = hotspotExplorerSchema.parse(base);

describe("HotspotExplorer", () => {
  it("opens panels, tracks visits and completes when everything is explored", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<HotspotExplorer config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("heading", { name: "Dashboard tour" })).toBeInTheDocument();
    expect(screen.getByText("0 of 3 explored")).toBeInTheDocument();
    const marker1 = screen.getByRole("button", { name: "Hotspot 1: KPI cards" });
    expect(marker1).toHaveAttribute("aria-expanded", "false");
    expect(marker1).toHaveStyle({ left: "20%", top: "30%" });
    const rect = screen.getByRole("button", { name: "Hotspot 3: Channel table" });
    expect(rect).toHaveAttribute("data-shape", "rect");
    expect(rect).toHaveStyle({ width: "30%", height: "15%" });

    await user.click(marker1);
    expect(marker1).toHaveAttribute("aria-expanded", "true");
    const panel = await screen.findByRole("group", { name: "Key metrics" });
    expect(within(panel).getByText("ROAS")).toBeInTheDocument();
    expect(screen.getByText("1 of 3 explored")).toBeInTheDocument();
    expect(marker1).toHaveAttribute("data-visited", "true");

    // Next / Previous navigation inside the panel.
    await user.click(within(panel).getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("group", { name: "Trend chart" })).toBeInTheDocument();
    expect(screen.getByText("2 of 3 explored")).toBeInTheDocument();

    // Accessible list is a full alternative.
    const list = screen.getByRole("region", { name: "Hotspots" });
    const items = within(list).getAllByRole("button");
    expect(items[0]).toHaveAttribute("data-visited", "true");
    expect(within(items[0]!).getByText("Visited")).toBeInTheDocument();
    await user.click(items[2]!);
    expect(await screen.findByRole("group", { name: "Channel table" })).toBeInTheDocument();

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0]![0];
    expect(result.score).toBeUndefined();
    expect(result.details).toEqual({ visited: ["kpi", "chart", "table"] });
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:interact");
    expect(await screen.findByText("You explored everything!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restart" })).toBeInTheDocument();
  });

  it("closes the panel with Escape and returns focus to the marker", async () => {
    const user = userEvent.setup();
    render(<HotspotExplorer config={config} />);
    const marker = screen.getByRole("button", { name: "Hotspot 2: Trend chart" });
    marker.focus();
    await user.keyboard("{Enter}");
    const panel = await screen.findByRole("group", { name: "Trend chart" });
    await waitFor(() => expect(panel).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("group", { name: "Trend chart" })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(marker).toHaveFocus());
    expect(marker).toHaveAttribute("aria-expanded", "false");

    // The close button also works.
    await user.click(marker);
    await user.click(await screen.findByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByRole("group", { name: "Trend chart" })).not.toBeInTheDocument(),
    );
  });

  it("offers a Finish button when not all hotspots are required", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const cfg = hotspotExplorerSchema.parse({ ...base, behavior: { requireAll: false } });
    render(<HotspotExplorer config={cfg} onComplete={onComplete} />);
    expect(screen.queryByRole("button", { name: "Finish" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hotspot 1: KPI cards" }));
    await user.click(await screen.findByRole("button", { name: "Finish" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0].details).toEqual({ visited: ["kpi"] });
  });

  it("resets when resetKey changes and via restart", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<HotspotExplorer config={config} resetKey={1} />);
    await user.click(screen.getByRole("button", { name: "Hotspot 1: KPI cards" }));
    expect(screen.getByText("1 of 3 explored")).toBeInTheDocument();
    rerender(<HotspotExplorer config={config} resetKey={2} />);
    await waitFor(() => expect(screen.getByText("0 of 3 explored")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Hotspot 1: KPI cards" })).toHaveAttribute(
      "data-visited",
      "false",
    );
  });

  it("renders an error state for invalid config", () => {
    render(
      <HotspotExplorer
        config={
          {
            id: "x",
            type: "hotspot-explorer",
            content: { image: { src: "a.png" }, hotspots: [] },
          } as never
        }
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });
});
