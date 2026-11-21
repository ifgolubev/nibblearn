import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoryCards } from "./StoryCards";
import { storyCardsSchema } from "@nibblearn/core";
import { latestState } from "../../../test/state-helpers";

const config = storyCardsSchema.parse({
  id: "story",
  type: "story-cards",
  title: "Welcome aboard",
  content: {
    cards: [
      {
        eyebrow: "Chapter 1",
        title: "Hello",
        body: "First paragraph.\n\nSecond paragraph.",
        layout: "cover",
      },
      {
        title: "Numbers",
        layout: "stat",
        stat: { value: "42", label: "clients" },
        expandable: { label: "Learn more", body: "Hidden detail." },
      },
      {
        title: "Quick check",
        body: "Answer the question.",
        check: {
          question: "What is CPC?",
          options: [{ text: "Cost per click", correct: true }, { text: "Clicks per campaign" }],
          explanation: "CPC is cost per click.",
        },
      },
      { body: "Teamwork wins.", title: "Agency founder", layout: "quote" },
    ],
  },
});

describe("StoryCards", () => {
  it("renders cards, reveals the expandable, requires the check and completes with a score", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<StoryCards config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("heading", { name: "Welcome aboard" })).toBeInTheDocument();
    expect(screen.getByText("Card 1 of 4")).toBeInTheDocument();
    expect(screen.getByText("Chapter 1")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Card 2 of 4")).toBeInTheDocument();
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.queryByText("Hidden detail.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Learn more" }));
    expect(await screen.findByText("Hidden detail.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Card 3 of 4")).toBeInTheDocument();
    await screen.findByText("What is CPC?");
    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Clicks per campaign/ }));
    expect(await screen.findByText("Not quite")).toBeInTheDocument();
    expect(screen.getByText("CPC is cost per click.")).toBeInTheDocument();
    expect(screen.getByText("Answered")).toBeInTheDocument();
    expect(next).toBeEnabled();
    await user.click(next);

    expect(await screen.findByText("Card 4 of 4")).toBeInTheDocument();
    expect(await screen.findByText("Teamwork wins.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0]![0];
    expect(result.score).toBe(0);
    expect(result.correct).toBe(0);
    expect(result.total).toBe(1);
    expect(result.details.checks).toEqual({ correct: 0, total: 1 });
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:answer");
    expect(await screen.findByRole("button", { name: "Restart" })).toBeInTheDocument();
  });

  it("completes without a score when there are no checks", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const noChecks = storyCardsSchema.parse({
      id: "s2",
      type: "story-cards",
      content: {
        cards: [
          { title: "One", body: "a" },
          { title: "Two", body: "b" },
        ],
      },
    });
    render(<StoryCards config={noChecks} onComplete={onComplete} />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("button", { name: "Finish" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0].score).toBeUndefined();
    expect(await screen.findByText("Well done!")).toBeInTheDocument();
  });

  it("navigates with arrow keys and hides Back when allowBack is false", async () => {
    const user = userEvent.setup();
    const first = render(<StoryCards config={config} />);
    screen.getByRole("button", { name: "Next" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(await screen.findByText("Card 2 of 4")).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(await screen.findByText("Card 1 of 4")).toBeInTheDocument();
    first.unmount();

    const noBack = storyCardsSchema.parse({ ...config, id: "nb", behavior: { allowBack: false } });
    render(<StoryCards config={noBack} />);
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("renders an error state for invalid config", () => {
    render(
      <StoryCards config={{ id: "x", type: "story-cards", content: { cards: [] } } as never} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<StoryCards config={config} resetKey={1} />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Card 2 of 4")).toBeInTheDocument();
    rerender(<StoryCards config={config} resetKey={2} />);
    await waitFor(() => expect(screen.getByText("Card 1 of 4")).toBeInTheDocument());
  });

  it("restores the current card and answered checks", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const first = render(<StoryCards config={config} onStateChange={onStateChange} />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("button", { name: "Next" }));
    await screen.findByText("What is CPC?");
    await user.click(screen.getByRole("radio", { name: /Clicks per campaign/ }));
    expect(await screen.findByText("Not quite")).toBeInTheDocument();
    const saved = await latestState(onStateChange);
    first.unmount();

    render(<StoryCards config={config} initialState={saved} />);
    expect(screen.getByText("Card 3 of 4")).toBeInTheDocument();
    expect(await screen.findByText("Not quite")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("restores a completed session without completing again", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const first = render(<StoryCards config={config} onStateChange={onStateChange} />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("button", { name: "Next" }));
    await screen.findByText("What is CPC?");
    await user.click(screen.getByRole("radio", { name: /Cost per click/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("button", { name: "Finish" }));
    const saved = await latestState(onStateChange);
    expect(saved.result).not.toBeNull();
    first.unmount();

    const onComplete = vi.fn();
    render(<StoryCards config={config} initialState={saved} onComplete={onComplete} />);
    expect(screen.queryByText(/Card \d of 4/)).not.toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe("StoryCards card options", () => {
  const make = (card: Record<string, unknown>) =>
    storyCardsSchema.parse({
      id: "story-opts",
      type: "story-cards",
      title: "Options",
      content: { cards: [{ title: "Card", body: "Text.", ...card }] },
    });
  const cardEl = () => document.querySelector(".nb-story__card")!;

  it("leaves the card unchanged when no option is set", () => {
    render(<StoryCards config={make({ image: { src: "/a.png", alt: "Chart" } })} />);
    expect(cardEl()).not.toHaveAttribute("data-align");
    expect(cardEl()).toHaveAttribute("data-media", "top");
    expect(screen.getByRole("img", { name: "Chart" })).not.toHaveAttribute("data-fit");
  });

  it("has no media position without media", () => {
    render(<StoryCards config={make({ mediaPosition: "left" })} />);
    expect(cardEl()).not.toHaveAttribute("data-media");
  });

  it("applies alignment, media position and image fit", () => {
    render(
      <StoryCards
        config={make({
          align: "center",
          mediaPosition: "right",
          imageFit: "contain",
          image: { src: "/a.png", alt: "Chart" },
        })}
      />,
    );
    expect(cardEl()).toHaveAttribute("data-align", "center");
    expect(cardEl()).toHaveAttribute("data-media", "right");
    expect(screen.getByRole("img", { name: "Chart" })).toHaveAttribute("data-fit", "contain");
    expect(document.querySelector(".nb-story__nav")).toHaveAttribute("data-wide");
  });

  it("puts bottom media after the text", () => {
    render(
      <StoryCards
        config={make({ mediaPosition: "bottom", image: { src: "/a.png", alt: "Chart" } })}
      />,
    );
    const media = document.querySelector(".nb-story__media")!;
    const content = document.querySelector(".nb-story__content")!;
    expect(content.compareDocumentPosition(media) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("plays a video in place of the image and reports the first play", () => {
    const onEvent = vi.fn();
    render(
      <StoryCards
        onEvent={onEvent}
        config={make({
          image: { src: "/a.png", alt: "Chart" },
          video: { src: "/intro.mp4", title: "Agency tour" },
        })}
      />,
    );
    const video = screen.getByLabelText("Agency tour");
    expect(video.tagName).toBe("VIDEO");
    expect(screen.queryByRole("img", { name: "Chart" })).not.toBeInTheDocument();
    fireEvent.play(video);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "module:interact",
        payload: expect.objectContaining({ action: "play-video", cardIndex: 0 }),
      }),
    );
  });

  it("keeps the hero image and shows the video in the body of a cover card", () => {
    render(
      <StoryCards
        config={make({
          layout: "cover",
          image: { src: "/a.png", alt: "Chart" },
          video: { src: "/intro.mp4" },
        })}
      />,
    );
    expect(screen.getByRole("img", { name: "Chart" })).toBeInTheDocument();
    expect(document.querySelector(".nb-story__content video")).not.toBeNull();
    expect(cardEl()).not.toHaveAttribute("data-media");
  });

  it("renders a link button; external links open in a new tab", async () => {
    const user = userEvent.setup();
    const onEvent = vi.fn();
    const { unmount } = render(
      <StoryCards
        onEvent={onEvent}
        config={make({
          action: { label: "Read the handbook", href: "https://brightline.example/h" },
        })}
      />,
    );
    const link = screen.getByRole("link", { name: /Read the handbook/ });
    expect(link).toHaveAttribute("href", "https://brightline.example/h");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAccessibleName(/^Read the handbook ?\(opens in a new tab\)$/);
    link.addEventListener("click", (e) => e.preventDefault());
    await user.click(link);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "module:interact",
        payload: expect.objectContaining({ action: "open-link" }),
      }),
    );
    unmount();

    render(<StoryCards config={make({ action: { label: "Jump", href: "#details" } })} />);
    expect(screen.getByRole("link", { name: "Jump" })).not.toHaveAttribute("target");
  });

  it("rejects unsafe video and link URLs", () => {
    for (const card of [
      { video: { src: "javascript:alert(1)" } },
      { video: { src: "data:video/mp4;base64,AAAA" } },
      { video: { src: "/a.mp4", poster: "javascript:alert(1)" } },
      { video: { src: "/a.mp4", captions: { src: "data:text/vtt,x" } } },
      { action: { label: "Go", href: "javascript:alert(1)" } },
      { action: { label: "Go", href: "//evil.example" } },
    ]) {
      const res = storyCardsSchema.safeParse({
        id: "x",
        type: "story-cards",
        content: { cards: [{ title: "Card", ...card }] },
      });
      expect(res.success, JSON.stringify(card)).toBe(false);
    }
  });
});
