import { useMemo } from "react";
import { Link, NavLink, useParams } from "react-router";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/CodeBlock";
import { useTitle } from "@/components/Seo";

const files = import.meta.glob("../../../../docs/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const order = [
  "getting-started",
  "lessons",
  "ai-content-generation",
  "theming",
  "progress",
  "events",
  "custom-modules",
  "embedding",
  "schema-reference",
  "accessibility",
  "release",
];

const docs = Object.entries(files)
  .map(([path, content]) => {
    const slug = path.split("/").pop()!.replace(/\.md$/, "");
    const title = content.match(/^#\s+(.+)$/m)?.[1] ?? slug;
    return { slug, title, content };
  })
  .sort((a, b) => {
    const ai = order.indexOf(a.slug);
    const bi = order.indexOf(b.slug);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

export function DocsPage() {
  const { slug } = useParams();
  const doc = useMemo(
    () => docs.find((d) => d.slug === (slug ?? "getting-started")) ?? docs[0],
    [slug],
  );
  useTitle(doc?.title ?? "Docs");
  if (!doc) return null;
  return (
    <div className="site-container grid gap-10 py-10 lg:grid-cols-[14rem_minmax(0,1fr)] sm:py-14">
      <nav aria-label="Documentation" className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
          Documentation
        </p>
        <ul className="flex flex-wrap gap-1 lg:flex-col">
          {docs.map((d) => (
            <li key={d.slug}>
              <NavLink
                to={`/docs/${d.slug}`}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-1.5 text-sm focus-ring ${isActive || (!slug && d.slug === "getting-started") ? "bg-surface-2 font-medium" : "text-muted hover:bg-surface-2 hover:text-[var(--site-fg)]"}`
                }
              >
                {d.title}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <article className="prose-docs min-w-0 max-w-3xl">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href = "", children }) => {
              if (href.startsWith("http"))
                return (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                );
              const internal = href.replace(/^\.\//, "").replace(/\.md$/, "");
              return <Link to={href.startsWith("/") ? href : `/docs/${internal}`}>{children}</Link>;
            },
            code: ({ className, children }) => {
              const match = /language-(\w+)/.exec(className ?? "");
              const text = String(children).replace(/\n$/, "");
              if (!match && !text.includes("\n")) return <code>{children}</code>;
              return <CodeBlock code={text} lang={match?.[1] ?? "text"} />;
            },
            pre: ({ children }) => <>{children}</>,
          }}
        >
          {doc.content}
        </Markdown>
      </article>
    </div>
  );
}
