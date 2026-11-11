import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryStorage } from "@nibblearn/core";
import { LessonPlayer } from "./LessonPlayer";

const lesson = {
  schemaVersion: 1,
  id: "test-lesson",
  title: "Test lesson",
  description: "Two quick questions.",
  objectives: ["Know things"],
  intro: { show: true, estimatedMinutes: 2 },
  modules: [
    {
      id: "q1",
      type: "choice-challenge",
      title: "First",
      content: {
        questions: [{ prompt: "1+1?", options: [{ text: "2", correct: true }, { text: "3" }] }],
      },
    },
    {
      id: "q2",
      type: "choice-challenge",
      title: "Second",
      content: {
        questions: [{ prompt: "2+2?", options: [{ text: "4", correct: true }, { text: "5" }] }],
      },
    },
  ],
};

async function answer(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(await screen.findByRole("radio", { name: text }));
  await user.click(screen.getByRole("button", { name: "Check" }));
  await user.click(await screen.findByRole("button", { name: "Finish" }));
}

describe("LessonPlayer", () => {
  it("plays a lesson from intro to summary, persisting progress", async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    render(
      <LessonPlayer lesson={lesson} storage={storage} onComplete={onComplete} onEvent={onEvent} />,
    );

    expect(await screen.findByRole("heading", { name: "Test lesson" })).toBeInTheDocument();
    expect(screen.getByText("2 activities")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start lesson" }));

    expect(
      await screen.findByText("Activity 1 of 2", { selector: ".nb-player__counter" }),
    ).toBeInTheDocument();
    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeDisabled();
    await answer(user, "2");
    await waitFor(() => expect(screen.getByRole("button", { name: "Next" })).toBeEnabled());
    expect(storage.dump()["test-lesson"]?.results["q1"]?.score).toBe(1);
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(
      await screen.findByText("Activity 2 of 2", { selector: ".nb-player__counter" }),
    ).toBeInTheDocument();
    await answer(user, "4");
    await user.click(await screen.findByRole("button", { name: "Finish lesson" }));

    expect(await screen.findByText("You did it!")).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0].score).toBe(1);
    expect(onComplete.mock.calls[0]![0].points).toBe(200);
    expect(storage.dump()["test-lesson"]?.completedAt).toBeTruthy();
    const types = onEvent.mock.calls.map((c) => c[0].type);
    expect(types).toContain("lesson:start");
    expect(types).toContain("module:complete");
    expect(types).toContain("lesson:complete");
  });

  it("offers to resume a saved session", async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();
    storage.save({
      version: 1,
      lessonId: "test-lesson",
      currentIndex: 1,
      results: {
        q1: {
          moduleId: "q1",
          moduleType: "choice-challenge",
          status: "completed",
          score: 1,
          attempts: 1,
          durationMs: 1,
          completedAt: "x",
        },
      },
      startedAt: "x",
      updatedAt: "x",
    });
    const onEvent = vi.fn();
    render(<LessonPlayer lesson={lesson} storage={storage} onEvent={onEvent} />);
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    expect(
      await screen.findByText("Activity 2 of 2", { selector: ".nb-player__counter" }),
    ).toBeInTheDocument();
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("lesson:resume");
  });

  it("shows readable errors for an invalid lesson", async () => {
    render(<LessonPlayer lesson={{ ...lesson, modules: [] }} storage={false} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/modules/);
  });

  it("supports autoStart and lesson retry", async () => {
    const user = userEvent.setup();
    render(
      <LessonPlayer
        lesson={{ ...lesson, modules: [lesson.modules[0]] }}
        storage={false}
        autoStart
      />,
    );
    expect(
      await screen.findByText("Activity 1 of 1", { selector: ".nb-player__counter" }),
    ).toBeInTheDocument();
    await answer(user, "2");
    await user.click(await screen.findByRole("button", { name: "Finish lesson" }));
    expect(await screen.findByText("You did it!")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry lesson" }));
    expect(
      await screen.findByText("Activity 1 of 1", { selector: ".nb-player__counter" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Check" })).toBeDisabled();
  });
});
