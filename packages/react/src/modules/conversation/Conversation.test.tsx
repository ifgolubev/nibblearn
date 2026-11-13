import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Conversation } from "./Conversation";
import { conversationSchema, type ConversationProvider } from "@nibblearn/core";

const base = {
  id: "conv",
  type: "conversation",
  title: "Friday 5pm",
  content: {
    contact: { name: "Priya Nair", role: "Marketing Lead", status: "Online" },
    start: "hello",
    nodes: [
      {
        id: "hello",
        messages: [
          { text: "Hey, do you have a minute?", delayMs: 0 },
          { text: "The landing page is down.", delayMs: 0 },
        ],
        responses: [
          {
            id: "r-own",
            text: "On it. Checking now.",
            next: "fix",
            tone: "Proactive",
            effectiveness: 0.9,
            feedback: "Fast and clear.",
          },
          {
            id: "r-vague",
            text: "Hmm, maybe Monday?",
            next: "cold",
            tone: "Vague",
            effectiveness: 0.2,
            feedback: "Too slow.",
          },
        ],
      },
      {
        id: "fix",
        messages: [
          { from: "system", text: "20 minutes later", delayMs: 0 },
          { text: "It's back up, thank you!", delayMs: 0 },
        ],
        responses: [
          {
            id: "r-close",
            text: "Glad to help.",
            next: "end-good",
            tone: "Empathetic",
            effectiveness: 0.8,
          },
        ],
      },
      {
        id: "end-good",
        messages: [{ text: "Have a great weekend.", delayMs: 0 }],
        outcome: "success",
        summary: "You acted fast.",
      },
      {
        id: "cold",
        messages: [{ text: "Never mind.", delayMs: 0 }],
        outcome: "failure",
        summary: "Urgency matters.",
      },
    ],
  },
  behavior: { typingIndicator: false },
} as const;

const config = conversationSchema.parse(base);

describe("Conversation", () => {
  it("plays messages, lets the learner reply, shows coaching and completes with a summary", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<Conversation config={config} onComplete={onComplete} onEvent={onEvent} />);

    expect(screen.getByRole("heading", { name: "Friday 5pm" })).toBeInTheDocument();
    expect(screen.getByText("Priya Nair")).toBeInTheDocument();
    expect(screen.getByText("PN")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();

    expect(await screen.findByText("The landing page is down.")).toBeInTheDocument();
    expect(screen.getByRole("log")).toHaveTextContent("Hey, do you have a minute?");
    expect(await screen.findByText("Choose your reply")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /On it\. Checking now\./ }));
    expect(screen.getByText("Fast and clear.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Effectiveness: 90%" })).toBeInTheDocument();

    expect(await screen.findByText("20 minutes later")).toBeInTheDocument();
    expect(await screen.findByText("It's back up, thank you!")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /Glad to help\./ }));

    expect(await screen.findByText("Have a great weekend.")).toBeInTheDocument();
    expect(await screen.findByText("Conversation summary")).toBeInTheDocument();
    expect(screen.getByText("The conversation went well")).toBeInTheDocument();
    expect(screen.getByText("You acted fast.")).toBeInTheDocument();
    expect(screen.getByText("Tones you used")).toBeInTheDocument();
    expect(screen.getAllByText("Empathetic").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Your replies")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const result = onComplete.mock.calls[0]![0];
    expect(result.score).toBeCloseTo(0.85);
    expect(result.details.outcome).toBe("success");
    expect(result.details.tones).toEqual(["Proactive", "Empathetic"]);
    expect(result.details.path).toEqual(["r-own", "r-close"]);
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:complete");
    expect(screen.getByRole("button", { name: "Replay conversation" })).toBeInTheDocument();
  });

  it("reaches a failure ending and can replay", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(<Conversation config={config} onComplete={onComplete} onEvent={onEvent} />);

    await user.click(await screen.findByRole("button", { name: /maybe Monday/ }));
    expect(await screen.findByText("Never mind.")).toBeInTheDocument();
    expect(await screen.findByText("The conversation went poorly")).toBeInTheDocument();
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete.mock.calls[0]![0].score).toBeCloseTo(0.2);

    await user.click(screen.getByRole("button", { name: "Replay conversation" }));
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:reset");
    await waitFor(() => expect(screen.queryByText("Conversation summary")).not.toBeInTheDocument());
    expect(await screen.findByRole("button", { name: /maybe Monday/ })).toBeInTheDocument();
    expect(screen.getByRole("log")).not.toHaveTextContent("Never mind.");
  });

  it("supports number keys to pick a reply", async () => {
    const user = userEvent.setup();
    render(<Conversation config={config} />);
    (await screen.findByRole("button", { name: /On it/ })).focus();
    await user.keyboard("2");
    expect(await screen.findByText("Never mind.")).toBeInTheDocument();
  });

  it("shows a typing indicator before incoming messages when enabled", async () => {
    const cfg = conversationSchema.parse({
      ...base,
      behavior: { typingIndicator: true },
      content: {
        ...base.content,
        nodes: [{ id: "hello", messages: [{ text: "Hey!", delayMs: 120 }], responses: [] }],
      },
    });
    render(<Conversation config={cfg} />);
    expect(await screen.findByText("Priya Nair is typing…")).toBeInTheDocument();
    expect(await screen.findByText("Hey!")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("Priya Nair is typing…")).not.toBeInTheDocument(),
    );
  });

  it("hides coaching notes when showFeedback is false", async () => {
    const user = userEvent.setup();
    const cfg = conversationSchema.parse({
      ...base,
      behavior: { typingIndicator: false, showFeedback: false },
    });
    render(<Conversation config={cfg} />);
    await user.click(await screen.findByRole("button", { name: /maybe Monday/ }));
    const log = screen.getByRole("log");
    expect(log).toHaveTextContent("Hmm, maybe Monday?");
    expect(log).not.toHaveTextContent("Too slow.");
    expect(within(log).queryByRole("img", { name: /Effectiveness/ })).not.toBeInTheDocument();
    expect(await screen.findByText("The conversation went poorly")).toBeInTheDocument();
    expect(log).not.toHaveTextContent("Too slow.");
  });

  it("accepts a custom provider", async () => {
    const user = userEvent.setup();
    const nodes = config.content.nodes;
    const provider: ConversationProvider = {
      start: vi.fn(async () => ({ node: nodes[0]!, done: false })),
      respond: vi.fn(async () => ({ node: nodes[2]!, done: true })),
    };
    const onComplete = vi.fn();
    render(<Conversation config={config} provider={provider} onComplete={onComplete} />);
    await user.click(await screen.findByRole("button", { name: /maybe Monday/ }));
    expect(provider.respond).toHaveBeenCalledWith("r-vague");
    expect(await screen.findByText("Have a great weekend.")).toBeInTheDocument();
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete.mock.calls[0]![0].details.outcome).toBe("success");
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Conversation config={config} resetKey={1} />);
    await user.click(await screen.findByRole("button", { name: /On it/ }));
    expect(await screen.findByText("It's back up, thank you!")).toBeInTheDocument();
    rerender(<Conversation config={config} resetKey={2} />);
    await waitFor(() => expect(screen.getByRole("log")).not.toHaveTextContent("It's back up"));
    expect(await screen.findByRole("button", { name: /On it/ })).toBeInTheDocument();
  });

  it("renders an error state for invalid config", () => {
    render(
      <Conversation
        config={
          {
            id: "x",
            type: "conversation",
            content: { contact: { name: "A" }, start: "nope", nodes: [] },
          } as never
        }
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/);
  });
});
