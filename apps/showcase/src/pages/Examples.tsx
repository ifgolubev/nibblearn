import { Link } from "react-router";
import { ArrowRight, Clock, Users } from "lucide-react";
import { useTitle } from "@/components/Seo";
import { lessons } from "@/lib/lessons";
import { getModuleDoc } from "@/lib/moduleDocs";

export function ExamplesPage() {
  useTitle("Example lessons");
  return (
    <div className="site-container py-12 sm:py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand dark:text-indigo-300">
          Example lessons
        </p>
        <h1 className="display display-blue mt-3 text-5xl sm:text-6xl">
          Complete, playable lessons
        </h1>
        <p className="mt-3 text-lg text-muted">
          Four original onboarding courses for a fictional marketing agency, built entirely from
          Nibblearn JSON. Progress is saved locally so you can leave and come back.
        </p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {lessons.map((l, i) => (
          <article
            key={l.id}
            className="group relative flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:shadow-float"
          >
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="rounded-full bg-brand-soft px-2.5 py-1 font-semibold text-brand dark:bg-indigo-500/15 dark:text-indigo-300">
                Example {String.fromCharCode(65 + i)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} aria-hidden /> {l.minutes} min
              </span>
              <span className="inline-flex items-center gap-1">
                <Users size={12} aria-hidden /> {l.audience}
              </span>
            </div>
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold leading-none tracking-[-0.025em]">
              <Link to={`/examples/${l.id}`} className="focus-ring after:absolute after:inset-0">
                {l.title}
              </Link>
            </h2>
            <p className="flex-1 text-sm text-muted">{l.description}</p>
            <ul className="flex flex-wrap gap-1.5">
              {[...new Set(l.modules)].map((t) => (
                <li key={t} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">
                  {getModuleDoc(t)?.name ?? t}
                </li>
              ))}
            </ul>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-brand dark:text-indigo-300">
              Start lesson <ArrowRight size={14} aria-hidden />
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}
