import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { accordionSchema } from "@nibblearn/core";
import { createExample } from "@nibblearn/core/examples";
import { latestState } from "../../../test/state-helpers";
import { Accordion } from "./Accordion";

const config = accordionSchema.parse(createExample("accordion"));
const titles = config.content.items.map((i) => i.title);

describe("Accordion", () => {
  it("opens one panel at a time and completes when every panel was opened", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Accordion config={config} onComplete={onComplete} />);
    const first = screen.getByRole("button", { name: titles[0] });
    expect(first).toHaveAttribute("aria-expanded", "false");
    await user.click(first);
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: titles[0] })).toBeVisible();
    await user.click(screen.getByRole("button", { name: titles[1] }));
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(onComplete).not.toHaveBeenCalled();
    for (const t of titles.slice(2)) await user.click(screen.getByRole("button", { name: t }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0].score).toBeUndefined();
  });

  it("renders lists inside panels and allows several open panels when configured", async () => {
    const user = userEvent.setup();
    render(
      <Accordion config={{ ...config, behavior: { ...config.behavior, allowMultiple: true } }} />,
    );
    await user.click(screen.getByRole("button", { name: titles[0] }));
    await user.click(screen.getByRole("button", { name: titles[1] }));
    expect(screen.getByRole("button", { name: titles[0] })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("region", { name: titles[1] }).querySelector("ul")).not.toBeNull();
  });

  it("completes on view by default", () => {
    const onComplete = vi.fn();
    render(
      <Accordion
        config={{ ...config, behavior: { ...config.behavior, completeOn: "view" } }}
        onComplete={onComplete}
      />,
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("restores open panels", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const first = render(<Accordion config={config} onStateChange={onStateChange} />);
    await user.click(screen.getByRole("button", { name: titles[2] }));
    const saved = await latestState(onStateChange);
    first.unmount();
    render(<Accordion config={config} initialState={saved} />);
    expect(screen.getByRole("button", { name: titles[2] })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("opens the focused panel in preview mode", () => {
    render(<Accordion config={config} mode="preview" focus={{ path: ["content", "items", 3] }} />);
    expect(screen.getByRole("button", { name: titles[3] })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
