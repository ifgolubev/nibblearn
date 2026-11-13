import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Code2 } from "lucide-react";
import { LessonPlayer, type LessonCompletion, type NibblearnEvent } from "@nibblearn/react";
import { useTitle } from "@/components/Seo";
import { CodeBlock } from "@/components/CodeBlock";
import { getLesson } from "@/lib/lessons";
import { stringify } from "@/lib/code";
import { useTheme } from "@/lib/theme";
import { NotFoundPage } from "./NotFound";

export function ExamplePage() {
  const { id = "" } = useParams();
  const meta = getLesson(id);
  const { mode } = useTheme();
  useTitle(meta?.title ?? "Example");
  const [events, setEvents] = useState<NibblearnEvent[]>([]);
  const [done, setDone] = useState<LessonCompletion | null>(null);
  const [showJson, setShowJson] = useState(false);
  const json = useMemo(() => (meta ? stringify(meta.lesson) : ""), [meta]);
  if (!meta) return <NotFoundPage />;

  return (
    <div className="site-container py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/examples"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-[var(--site-fg)] focus-ring"
        >
          <ArrowLeft size={14} aria-hidden /> All examples
        </Link>
        <button
          type="button"
          onClick={() => setShowJson((s) => !s)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-2 focus-ring"
          aria-expanded={showJson}
        >
          <Code2 size={16} aria-hidden /> {showJson ? "Hide" : "View"} lesson JSON
        </button>
      </div>
      <div className="mt-6" data-testid="lesson-player">
        <LessonPlayer
          lesson={meta.lesson}
          theme={mode}
          onEvent={(e) => setEvents((prev) => [e, ...prev].slice(0, 30))}
          onComplete={setDone}
        />
      </div>
      {done && (
        <p
          className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100"
          role="status"
        >
          <strong>onComplete</strong> fired: score {Math.round(done.score * 100)}%, {done.points}/
          {done.maxPoints} points, {done.passed ? "passed" : "not passed"}.
        </p>
      )}
      {showJson && (
        <CodeBlock className="mt-6" lang="json" title={`${meta.id}.json`} code={json} collapsible />
      )}
      <details className="mt-8 rounded-xl border border-line bg-surface p-4 text-sm">
        <summary className="cursor-pointer font-medium">Event log ({events.length})</summary>
        <ul
          className="mt-3 max-h-64 space-y-1 overflow-auto font-mono text-xs text-muted"
          aria-live="off"
        >
          {events.map((e, i) => (
            <li key={i}>
              <span className="text-brand dark:text-indigo-300">{e.type}</span> {e.moduleId ?? ""}{" "}
              {e.payload ? JSON.stringify(e.payload) : ""}
            </li>
          ))}
          {events.length === 0 && <li>Interact with the lesson to see events.</li>}
        </ul>
      </details>
    </div>
  );
}
