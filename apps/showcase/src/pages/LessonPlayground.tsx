import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { LessonPlayer, validateLesson, type Lesson } from "@nibblearn/react";
import { JsonEditor } from "@/components/JsonEditor";
import { useTitle } from "@/components/Seo";
import { getDemo } from "@/lib/demos";
import { stringify } from "@/lib/code";
import { useJsonState } from "@/lib/usePlaygroundState";
import { useTheme } from "@/lib/theme";

function buildStarter() {
  const pick = ["story-cards", "flashcards", "choice-challenge", "true-false"]
    .map((t) => getDemo(t))
    .filter(Boolean);
  return {
    schemaVersion: 1,
    id: "playground-lesson",
    title: "My first lesson",
    description:
      "A lesson assembled in the playground. Edit the JSON on the left to add or reorder activities.",
    objectives: ["See how modules combine into one lesson", "Try progress, scoring and completion"],
    intro: { show: true, estimatedMinutes: 5 },
    gamification: { points: true, celebration: true, streaks: true },
    modules: pick,
  };
}

export function LessonPlaygroundPage() {
  useTitle("Lesson playground");
  const { mode } = useTheme();
  const starter = useMemo(() => stringify(buildStarter()), []);
  const validate = useCallback((v: unknown) => validateLesson(v), []);
  const state = useJsonState<Lesson>(starter, validate);
  const [lastGood, setLastGood] = useState<Lesson | null>(state.data);
  const [seen, setSeen] = useState<Lesson | null>(state.data);
  const [version, setVersion] = useState(0);
  if (state.data && state.data !== seen) {
    // Derive "last valid config" during render (React-sanctioned pattern, no effect needed).
    setSeen(state.data);
    setLastGood(state.data);
    setVersion(version + 1);
  }

  return (
    <div className="site-container py-10 sm:py-14">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand dark:text-indigo-300">
            Lesson playground
          </p>
          <h1 className="display display-blue mt-3 text-5xl sm:text-6xl">
            Combine modules into a lesson
          </h1>
          <p className="mt-3 text-muted">
            A lesson is just an ordered list of module configurations plus a few settings. The
            player handles intro, navigation, progress, scoring and completion.
          </p>
        </div>
        <Link
          to="/playground"
          className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium hover:bg-surface-2 focus-ring"
        >
          ← Module playground
        </Link>
      </div>
      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <JsonEditor
          value={state.text}
          onChange={state.setText}
          issues={state.issues}
          parseError={state.parseError}
          onReset={() => state.reset(starter)}
          fileName="lesson.json"
          label="Lesson"
        />
        <div className="min-w-0">
          {lastGood ? (
            <LessonPlayer key={version} lesson={lastGood} storage={false} theme={mode} />
          ) : (
            <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
              Fix the JSON to see the lesson.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
