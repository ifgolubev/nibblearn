import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { tabsSchema } from "@nibblearn/core";
import { createExample } from "@nibblearn/core/examples";
import { latestState } from "../../../test/state-helpers";
import { Tabs } from "./Tabs";

const config = tabsSchema.parse(createExample("tabs"));
const labels = config.content.tabs.map((t) => t.label);

describe("Tabs", () => {
  it("follows the tabs pattern with roving focus and arrow keys", async () => {
    const user = userEvent.setup();
    render(<Tabs config={config} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
    expect(screen.getByRole("tabpanel", { name: labels[0] })).toBeInTheDocument();
    tabs[0]!.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: labels[1] })).toHaveFocus();
    expect(screen.getByRole("tab", { name: labels[1] })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: labels[2] })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: labels[0] })).toHaveFocus();
    await user.keyboard("{ArrowLeft}{Home}");
    expect(screen.getByRole("tabpanel", { name: labels[0] })).toBeInTheDocument();
  });

  it("completes once every tab was viewed when configured", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(
      <Tabs
        config={{ ...config, behavior: { completeOn: "all-items" } }}
        onComplete={onComplete}
      />,
    );
    expect(screen.getByText("1 of 3 viewed")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: labels[1] }));
    expect(onComplete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("tab", { name: labels[2] }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("restores the active tab and follows focus in preview", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const first = render(<Tabs config={config} onStateChange={onStateChange} />);
    await user.click(screen.getByRole("tab", { name: labels[2] }));
    const saved = await latestState(onStateChange);
    first.unmount();
    const { unmount } = render(<Tabs config={config} initialState={saved} />);
    expect(screen.getByRole("tab", { name: labels[2] })).toHaveAttribute("aria-selected", "true");
    unmount();
    render(<Tabs config={config} mode="preview" focus={{ path: ["content", "tabs", 1] }} />);
    expect(screen.getByRole("tab", { name: labels[1] })).toHaveAttribute("aria-selected", "true");
  });
});
