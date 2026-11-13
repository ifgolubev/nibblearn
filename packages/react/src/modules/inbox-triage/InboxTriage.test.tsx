import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { inboxTriageSchema, type InboxTriageInput } from "@nibblearn/core";
import { InboxTriage } from "./InboxTriage";

const base = {
  id: "inbox",
  type: "inbox-triage",
  title: "Monday inbox",
  instructions: "Decide what to do with each message.",
  content: {
    owner: { name: "Jordan Reyes", role: "Account Manager" },
    actions: [
      { id: "reply", label: "Reply now", icon: "reply", tone: "accent", description: "Do it now." },
      { id: "delegate", label: "Delegate", icon: "forward", tone: "sky" },
      { id: "archive", label: "Archive", icon: "archive" },
    ],
    messages: [
      {
        id: "vip",
        from: { name: "Priya Nair", role: "Marketing Lead", email: "priya@harbor.co" },
        subject: "Conversions at zero",
        preview: "Since midnight nothing has tracked.",
        body: "Please help before 10:00.",
        time: "08:57",
        flags: ["vip", "external"],
        correctAction: "reply",
        explanation: "A VIP with a deadline comes first.",
      },
      {
        id: "po",
        from: { name: "Helen Brooks" },
        subject: "PO number missing",
        preview: "We need the PO.",
        body: "Could someone send the PO?",
        time: "08:15",
        flags: ["attachment"],
        correctAction: "delegate",
        acceptable: ["reply"],
        explanation: "The coordinator owns the PO log.",
      },
      {
        id: "news",
        from: { name: "Pulse Analytics" },
        subject: "What's new",
        preview: "Release notes.",
        body: "New features shipped.",
        time: "07:30",
        correctAction: "archive",
        explanation: "Nothing to do.",
      },
    ],
    summary: "Fires first, then the rest.",
  },
} satisfies InboxTriageInput;

const config = inboxTriageSchema.parse(base);

function list() {
  return screen.getByRole("list", { name: "Messages" });
}
function item(name: RegExp) {
  return within(list()).getByRole("button", { name });
}
function action(name: string) {
  return screen.getByRole("button", { name: new RegExp(`^${name}`) });
}

describe("InboxTriage", () => {
  it("renders the inbox with unread messages, flags and an empty reading pane", () => {
    render(<InboxTriage config={config} />);
    expect(screen.getByRole("heading", { name: "Monday inbox" })).toBeInTheDocument();
    expect(screen.getByText("0 of 3 handled")).toBeInTheDocument();
    expect(screen.getByText("3 unread")).toBeInTheDocument();
    expect(within(list()).getAllByRole("button")).toHaveLength(3);
    expect(item(/Priya Nair/)).toHaveAccessibleName(
      /Priya Nair.*Conversions at zero.*Unread, VIP, External sender/,
    );
    expect(screen.getByText("3 messages waiting")).toBeInTheDocument();
  });

  it("opens a message, coaches an instant decision and moves to the next unhandled one", async () => {
    const user = userEvent.setup();
    const onEvent = vi.fn();
    render(<InboxTriage config={config} onEvent={onEvent} />);
    await user.click(item(/Priya Nair/));

    const subject = screen.getByRole("heading", { name: "Conversions at zero" });
    expect(subject).toHaveFocus();
    expect(screen.getByText("Please help before 10:00.")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Message flags" })).toHaveTextContent("VIP");
    expect(screen.getByText("2 unread")).toBeInTheDocument();
    expect(action("Reply now")).toHaveAccessibleDescription("Do it now.");

    await user.click(action("Delegate"));
    expect(await screen.findByText("Not the best call")).toBeInTheDocument();
    expect(screen.getByText("Expert call: Reply now")).toBeInTheDocument();
    expect(screen.getByText("A VIP with a deadline comes first.")).toBeInTheDocument();
    expect(action("Delegate")).toHaveAttribute("aria-pressed", "true");
    expect(action("Reply now")).toBeDisabled();
    expect(screen.getByText("1 of 3 handled")).toBeInTheDocument();
    expect(item(/Priya Nair/)).toHaveAccessibleName(/Handled: Delegate, Not the best call/);
    const answer = onEvent.mock.calls.find((c) => c[0].type === "module:answer")![0];
    expect(answer.payload).toMatchObject({ messageId: "vip", action: "delegate", status: "wrong" });

    const next = screen.getByRole("button", { name: "Next message" });
    expect(next).toHaveFocus();
    await user.click(next);
    expect(screen.getByRole("heading", { name: "PO number missing" })).toHaveFocus();
    await user.click(action("Reply now"));
    expect(await screen.findByText("Acceptable")).toBeInTheDocument();
  });

  it("completes with a summary, breakdown, missed priorities and retry", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<InboxTriage config={config} onComplete={onComplete} />);
    await user.click(item(/Priya Nair/));
    await user.click(action("Archive"));
    await user.click(screen.getByRole("button", { name: "Next message" }));
    await user.click(action("Delegate"));
    await user.click(screen.getByRole("button", { name: "Next message" }));
    await user.click(action("Archive"));
    await user.click(screen.getByRole("button", { name: "See results" }));

    expect(await screen.findByText("Inbox zero")).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0]![0];
    expect(result.score).toBeCloseTo(2 / 3);
    expect(result).toMatchObject({ correct: 2, total: 3 });
    expect(result.details.missedPriority).toEqual(["vip"]);
    expect(screen.getByText("Fires first, then the rest.")).toBeInTheDocument();
    expect(screen.getByText("Priority messages you missed")).toBeInTheDocument();
    expect(screen.getByText("Archive: you 2, expert 1")).toBeInTheDocument();
    expect(screen.getAllByText("Expert: Reply now").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("67% score")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("0 of 3 handled")).toBeInTheDocument();
    expect(screen.getByText("3 unread")).toBeInTheDocument();
  });

  it("is keyboard operable: arrows move through the list, Enter opens, digits act", async () => {
    const user = userEvent.setup();
    render(<InboxTriage config={config} />);
    const items = within(list()).getAllByRole("button");
    expect(items[0]).toHaveAttribute("tabindex", "0");
    expect(items[1]).toHaveAttribute("tabindex", "-1");
    await user.tab();
    expect(items[0]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await user.keyboard("{End}");
    expect(items[2]).toHaveFocus();
    await user.keyboard("{Home}{ArrowDown}{Enter}");
    expect(screen.getByRole("heading", { name: "PO number missing" })).toHaveFocus();
    await user.keyboard("2");
    expect(await screen.findByText("Good call")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next message" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "What's new" })).toHaveFocus();
    // Escape returns focus to the message in the list.
    await user.keyboard("{Escape}");
    expect(items[2]).toHaveFocus();
  });

  it("with end feedback, files decisions silently and allows changing them", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(
      <InboxTriage
        config={inboxTriageSchema.parse({ ...base, behavior: { feedback: "end" } })}
        onComplete={onComplete}
      />,
    );
    await user.click(item(/Priya Nair/));
    await user.click(action("Archive"));
    expect(screen.getByText(/Filed under Archive/)).toBeInTheDocument();
    expect(screen.queryByText("Not the best call")).not.toBeInTheDocument();
    await user.click(action("Reply now"));
    expect(action("Reply now")).toHaveAttribute("aria-pressed", "true");
    expect(action("Archive")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("1 of 3 handled")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next message" }));
    await user.keyboard("2");
    await user.click(screen.getByRole("button", { name: "Next message" }));
    await user.keyboard("3");
    await user.click(screen.getByRole("button", { name: "See results" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete.mock.calls[0]![0].score).toBe(1);
    expect(
      screen.getByText("Every priority message got the attention it needed."),
    ).toBeInTheDocument();
  });

  it("resets when resetKey changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<InboxTriage config={config} resetKey={0} />);
    await user.click(item(/Priya Nair/));
    await user.click(action("Reply now"));
    expect(screen.getByText("1 of 3 handled")).toBeInTheDocument();
    rerender(<InboxTriage config={config} resetKey={1} />);
    expect(await screen.findByText("0 of 3 handled")).toBeInTheDocument();
    expect(screen.getByText("3 messages waiting")).toBeInTheDocument();
  });

  it("shows an alert for an invalid config", () => {
    render(
      <InboxTriage
        config={
          {
            ...base,
            content: {
              ...base.content,
              messages: [{ ...base.content.messages[0], correctAction: "x" }],
            },
          } as never
        }
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("inbox-triage");
  });
});
