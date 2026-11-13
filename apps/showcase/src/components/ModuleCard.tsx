import { Link } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { Icon } from "./Icon";
import type { ModuleDoc } from "@/lib/moduleDocs";

const categoryTone: Record<string, string> = {
  learn: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200",
  practice: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
  explore: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  decide: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/15 dark:text-fuchsia-200",
  simulate: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200",
};

export function ModuleCard({
  doc,
  onPreview,
}: {
  doc: ModuleDoc;
  onPreview?: (doc: ModuleDoc) => void;
}) {
  return (
    <article className="group relative flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-float">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white shadow-[0_8px_20px_-8px_rgba(0,9,220,0.6)] transition dark:bg-[#3b5bdb]">
          <Icon name={doc.icon} size={22} aria-hidden />
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${categoryTone[doc.category]}`}
        >
          {doc.category}
        </span>
      </div>
      <div className="flex-1">
        <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold leading-none tracking-[-0.02em]">
          <Link to={`/modules/${doc.type}`} className="focus-ring after:absolute after:inset-0">
            {doc.name}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted">{doc.tagline}</p>
      </div>
      <div className="relative z-10 flex items-center gap-2">
        {onPreview && (
          <button
            type="button"
            onClick={() => onPreview(doc)}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium hover:bg-surface-2 focus-ring dark:bg-transparent"
          >
            Try it
          </button>
        )}
        <Link
          to={`/modules/${doc.type}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline focus-ring dark:text-indigo-300"
        >
          Docs <ArrowUpRight size={14} aria-hidden />
        </Link>
      </div>
    </article>
  );
}
