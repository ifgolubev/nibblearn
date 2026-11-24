import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { carouselSchema } from "@nibblearn/core";
import { createExample } from "@nibblearn/core/examples";
import { latestState } from "../../../test/state-helpers";
import { Carousel } from "./Carousel";

const config = carouselSchema.parse(createExample("carousel"));
const titles = config.content.slides.map((s) => s.title!);

describe("Carousel", () => {
  it("keeps keyboard focus on Next at the last slide", async () => {
    const user = userEvent.setup();
    render(<Carousel config={config} />);
    const next = screen.getByRole("button", { name: "Next slide" });
    next.focus();
    for (let i = 0; i < titles.length + 1; i++) await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: titles.at(-1) })).toBeInTheDocument();
    expect(next).toHaveFocus();
    expect(next).toBeEnabled(); // focusable; marked aria-disabled instead
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("heading", { name: titles.at(-2) })).toBeInTheDocument();
  });

  it("moves with buttons, dots and arrow keys and completes after every slide", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Carousel config={config} onComplete={onComplete} />);
    expect(screen.getByRole("group", { name: "1 of 4" })).toHaveTextContent(titles[0]!);
    expect(screen.getByRole("button", { name: "Previous slide" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Next slide" }));
    expect(screen.getByRole("heading", { name: titles[1] })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to slide 4" }));
    expect(screen.getByRole("button", { name: "Go to slide 4" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "Next slide" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(onComplete).not.toHaveBeenCalled();
    screen.getByRole("button", { name: "Previous slide" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("heading", { name: titles[2] })).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("swipes on touch and loops when configured", () => {
    render(<Carousel config={{ ...config, behavior: { ...config.behavior, loop: true } }} />);
    const slide = screen.getByRole("group", { name: "1 of 4" });
    fireEvent.pointerDown(slide, { pointerType: "touch", clientX: 200 });
    fireEvent.pointerUp(slide, { pointerType: "touch", clientX: 100 });
    expect(screen.getByRole("heading", { name: titles[1] })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(screen.getByRole("heading", { name: titles[3] })).toBeInTheDocument();
  });

  it("drags with the mouse from the image or background, not from text", () => {
    render(<Carousel config={config} />);
    const slide = screen.getByRole("group", { name: "1 of 4" });
    // Text stays selectable: a press on the heading does not start a drag.
    const heading = screen.getByRole("heading", { name: titles[0] });
    fireEvent.pointerDown(heading, { pointerType: "mouse", button: 0, clientX: 200 });
    fireEvent.pointerUp(slide, { pointerType: "mouse", clientX: 100 });
    expect(screen.getByRole("heading", { name: titles[0] })).toBeInTheDocument();
    // The right button never drags.
    fireEvent.pointerDown(slide, { pointerType: "mouse", button: 2, clientX: 200 });
    fireEvent.pointerUp(slide, { pointerType: "mouse", clientX: 100 });
    expect(screen.getByRole("heading", { name: titles[0] })).toBeInTheDocument();
    fireEvent.pointerDown(slide, { pointerType: "mouse", button: 0, clientX: 200 });
    fireEvent.pointerUp(slide, { pointerType: "mouse", clientX: 100 });
    expect(screen.getByRole("heading", { name: titles[1] })).toBeInTheDocument();
  });

  it("restores the slide and follows focus in preview", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const first = render(<Carousel config={config} onStateChange={onStateChange} />);
    await user.click(screen.getByRole("button", { name: "Next slide" }));
    const saved = await latestState(onStateChange);
    first.unmount();
    const { unmount } = render(<Carousel config={config} initialState={saved} />);
    expect(screen.getByRole("heading", { name: titles[1] })).toBeInTheDocument();
    unmount();
    render(<Carousel config={config} mode="preview" focus={{ path: ["content", "slides", 3] }} />);
    expect(screen.getByRole("heading", { name: titles[3] })).toBeInTheDocument();
  });
});
