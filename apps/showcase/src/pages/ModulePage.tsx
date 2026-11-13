import { useMemo } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { ModuleRenderer } from "@nibblearn/react";
import { DemoFrame } from "@/components/DemoFrame";
import { CodeBlock } from "@/components/CodeBlock";
import { Icon } from "@/components/Icon";
import { useTitle } from "@/components/Seo";
import { moduleDocs, getModuleDoc } from "@/lib/moduleDocs";
import { getDemo } from "@/lib/demos";
import { componentNames, reactSnippet, stringify } from "@/lib/code";
import { NotFoundPage } from "./NotFound";

export function ModulePage() {
  const { type = "" } = useParams();
  const doc = getModuleDoc(type);
  const demo = getDemo(type);
  useTitle(doc?.name ?? "Module");
  const json = useMemo(() => (demo ? stringify(demo) : ""), [demo]);
  if (!doc) return <NotFoundPage />;
  const idx = moduleDocs.findIndex((m) => m.type === type);
  const prev = moduleDocs[(idx - 1 + moduleDocs.length) % moduleDocs.length]!;
  const next = moduleDocs[(idx + 1) % moduleDocs.length]!;

  return (
    <div className="site-container py-10 sm:py-14">
      <Link
        to="/modules"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-[var(--site-fg)] focus-ring"
      >
        <ArrowLeft size={14} aria-hidden /> All modules
      </Link>
      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand dark:bg-indigo-500/15 dark:text-indigo-300">
              <Icon name={doc.icon} size={24} aria-hidden />
            </span>
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold capitalize text-muted">
              {doc.category}
            </span>
            <code className="rounded-md bg-surface-2 px-2 py-1 text-xs">type: "{doc.type}"</code>
          </div>
          <h1 className="display display-blue mt-4 text-5xl sm:text-6xl">{doc.name}</h1>
          <p className="mt-2 text-lg text-muted">{doc.tagline}</p>
        </div>
        <nav className="flex gap-2 text-sm" aria-label="Module navigation">
          <Link
            to={`/modules/${prev.type}`}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 hover:bg-surface-2 focus-ring"
          >
            <ArrowLeft size={14} aria-hidden /> {prev.name}
          </Link>
          <Link
            to={`/modules/${next.type}`}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 hover:bg-surface-2 focus-ring"
          >
            {next.name} <ArrowRight size={14} aria-hidden />
          </Link>
        </nav>
      </div>

      <section className="mt-8" aria-labelledby="demo-heading">
        <h2 id="demo-heading" className="sr-only">
          Live demo
        </h2>
        {demo ? (
          <DemoFrame>
            {(resetKey) => <ModuleRenderer config={demo} resetKey={resetKey} />}
          </DemoFrame>
        ) : (
          <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">
            Demo coming soon.
          </div>
        )}
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-12">
          <section>
            <h2 className="display display-blue text-3xl">Overview</h2>
            <p className="mt-3 leading-relaxed text-muted">{doc.description}</p>
          </section>
          <section>
            <h2 className="display display-blue text-3xl">JSON configuration</h2>
            <p className="mt-2 text-sm text-muted">
              This is the exact configuration powering the demo above. Paste it into the{" "}
              <Link
                className="text-brand underline dark:text-indigo-300"
                to={`/playground?module=${doc.type}`}
              >
                playground
              </Link>{" "}
              to edit it live.
            </p>
            {demo && (
              <CodeBlock className="mt-4" lang="json" title={`${doc.type}.json`} code={json} />
            )}
          </section>
          <section>
            <h2 className="display display-blue text-3xl">React usage</h2>
            <p className="mt-2 text-sm text-muted">
              Import the component directly, or render any config through{" "}
              <code>ModuleRenderer</code> / <code>LessonPlayer</code>.
            </p>
            {demo && (
              <CodeBlock
                className="mt-4"
                lang="tsx"
                title="Activity.tsx"
                code={reactSnippet(componentNames[doc.type] ?? "ModuleRenderer", doc.type, demo.id)}
              />
            )}
          </section>
          <section>
            <h2 className="display display-blue text-3xl">Options</h2>
            <div
              className="mt-4 overflow-x-auto rounded-xl border border-line focus-ring"
              tabIndex={0}
              role="region"
              aria-label={`${doc.name} options`}
            >
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Path</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Default</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.options.map((o) => (
                    <tr key={o.path} className="border-t border-line align-top">
                      <td className="px-4 py-3 font-mono text-xs">{o.path}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{o.type}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{o.default ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{o.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <aside className="space-y-8">
          <Panel title="Use cases" items={doc.useCases} />
          <Panel title="Interaction" items={doc.interactions} />
          <Panel title="Accessibility" items={doc.accessibility} />
          <div className="rounded-2xl border border-line bg-surface p-5 text-sm">
            <h3 className="font-semibold">Theming</h3>
            <p className="mt-2 text-muted">
              Light and dark themes are built in. Override <code>--nb-accent</code>, radii, fonts
              and shadows with CSS variables — see the{" "}
              <Link className="text-brand underline dark:text-indigo-300" to="/docs/theming">
                theming guide
              </Link>
              .
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Panel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-muted">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <Check
              size={16}
              aria-hidden
              className="mt-0.5 flex-none text-brand dark:text-indigo-300"
            />
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
