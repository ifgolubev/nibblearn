import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { NibblearnProvider } from "@nibblearn/react";
import "@nibblearn/editor/styles.css";
import { LessonEditor } from "@nibblearn/editor";
import { welcomeToTheAgencyLesson } from "@nibblearn/examples";
import { useTitle } from "@/components/Seo";
import { useTheme } from "@/lib/theme";

export function EditorPage() {
  useTitle("Editor");
  const { mode } = useTheme();
  const [lesson, setLesson] = useState<Record<string, unknown>>(
    () => structuredClone(welcomeToTheAgencyLesson) as unknown as Record<string, unknown>,
  );
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(lesson, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand dark:text-indigo-300">
            Editor
          </p>
          <h1 className="display display-blue mt-3 text-5xl sm:text-6xl">
            Author lessons visually
          </h1>
          <p className="mt-3 text-muted">
            <code>@nibblearn/editor</code> builds these forms from the module schemas. Edit a block
            and the preview follows the item you are working on.
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="focus-ring inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold"
        >
          {copied ? <Check aria-hidden size={16} /> : <Copy aria-hidden size={16} />}
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
      <NibblearnProvider theme={mode}>
        <LessonEditor value={lesson} onChange={setLesson} />
      </NibblearnProvider>
    </div>
  );
}
