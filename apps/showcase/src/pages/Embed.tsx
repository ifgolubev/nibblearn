import { useParams } from "react-router";
import { LessonPlayer } from "@nibblearn/react";
import { getLesson } from "@/lib/lessons";
import { useTitle } from "@/components/Seo";

/** Origin of the embedding page (from the referrer), or null when not embedded / unknown. */
function parentOrigin(): string | null {
  if (window.parent === window || !document.referrer) return null;
  try {
    return new URL(document.referrer).origin;
  } catch {
    return null;
  }
}

/**
 * Standalone lesson page without site chrome, intended for <iframe> embedding.
 * Posts progress events to the parent window via postMessage.
 */
export function EmbedPage() {
  const { id = "" } = useParams();
  const meta = getLesson(id);
  useTitle(meta?.title ?? "Lesson");
  if (!meta) return <div className="p-6 text-sm">Lesson not found.</div>;
  return (
    <div className="min-h-screen bg-[var(--site-bg)] p-3 sm:p-6">
      <LessonPlayer
        lesson={meta.lesson}
        onEvent={(e) => {
          // Send events only to the page that embedded us, never to "*".
          const target = parentOrigin();
          if (target) window.parent.postMessage({ source: "nibblearn", event: e }, target);
        }}
      />
    </div>
  );
}
