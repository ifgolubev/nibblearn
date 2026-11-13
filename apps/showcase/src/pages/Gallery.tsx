import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Search, X } from "lucide-react";
import { ModuleRenderer } from "@nibblearn/react";
import { ModuleCard } from "@/components/ModuleCard";
import { DemoFrame } from "@/components/DemoFrame";
import { useTitle } from "@/components/Seo";
import { categories, moduleDocs, type ModuleDoc } from "@/lib/moduleDocs";
import { getDemo } from "@/lib/demos";

export function GalleryPage() {
  useTitle("Modules");
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "all";
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [preview, setPreview] = useState<ModuleDoc | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return moduleDocs.filter(
      (m) =>
        (category === "all" || m.category === category) &&
        (!q ||
          m.name.toLowerCase().includes(q) ||
          m.tagline.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.useCases.some((u) => u.toLowerCase().includes(q))),
    );
  }, [category, query]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (preview && !d.open) d.showModal();
    if (!preview && d.open) d.close();
  }, [preview]);

  const setCategory = (c: string) => {
    const next = new URLSearchParams(params);
    if (c === "all") next.delete("category");
    else next.set("category", c);
    setParams(next, { replace: true });
  };

  return (
    <div className="site-container py-12 sm:py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand dark:text-indigo-300">
          Module gallery
        </p>
        <h1 className="display display-blue mt-3 text-5xl sm:text-6xl">
          {moduleDocs.length} interactive learning modules
        </h1>
        <p className="mt-3 text-lg text-muted">
          Every module is a fully functional React component with a typed JSON configuration. Filter
          by category, search, and try each one live.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Categories">
          {[{ id: "all", label: "All" }, ...categories].map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium focus-ring ${category === c.id ? "bg-[var(--site-fg)] text-[var(--site-bg)]" : "bg-surface-2 text-muted hover:text-[var(--site-fg)]"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <label className="relative block md:w-72">
          <span className="sr-only">Search modules</span>
          <Search
            size={16}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules…"
            className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm focus-ring"
          />
        </label>
      </div>

      <p className="mt-6 text-sm text-muted" aria-live="polite">
        {filtered.length} of {moduleDocs.length} modules
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => (
          <ModuleCard key={m.type} doc={m} onPreview={getDemo(m.type) ? setPreview : undefined} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-line p-10 text-center text-muted">
          No modules match “{query}”.
        </div>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setPreview(null)}
        className="m-auto w-[min(100%-1.5rem,64rem)] rounded-2xl border border-line bg-[var(--site-bg)] p-0 text-[var(--site-fg)] shadow-float backdrop:bg-black/50"
        aria-label={preview ? `${preview.name} preview` : "Preview"}
      >
        {preview && (
          <div className="p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{preview.name}</h2>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-surface-2 focus-ring"
                aria-label="Close preview"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <DemoFrame plain themeToggle={false}>
              {(resetKey) => <ModuleRenderer config={getDemo(preview.type)!} resetKey={resetKey} />}
            </DemoFrame>
          </div>
        )}
      </dialog>
    </div>
  );
}
