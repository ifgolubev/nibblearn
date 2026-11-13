import { useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import {
  Accessibility,
  ArrowRight,
  Blocks,
  Bot,
  Check,
  Copy,
  Flame,
  Gauge,
  Languages,
  MousePointerClick,
  Palette,
  Save,
  Sparkles,
  Star,
  Terminal,
  TrendingUp,
  Zap,
} from "lucide-react";
import { NibblearnProvider, ModuleRenderer } from "@nibblearn/react";
import { useTitle } from "@/components/Seo";
import { CodeBlock } from "@/components/CodeBlock";
import { ModuleCard } from "@/components/ModuleCard";
import { Icon } from "@/components/Icon";
import { GITHUB_URL, GithubIcon } from "@/components/Layout";
import { categories, moduleDocs } from "@/lib/moduleDocs";
import { getDemo } from "@/lib/demos";
import { useTheme } from "@/lib/theme";

const heroTabs = [
  { type: "flashcards", label: "Flashcards" },
  { type: "true-false", label: "True / False" },
  { type: "choice-challenge", label: "Choice" },
  { type: "match-pairs", label: "Match" },
];

const quickStart = `import { LessonPlayer, defineLesson } from "@nibblearn/react";
import "@nibblearn/react/styles.css";

const lesson = defineLesson({
  schemaVersion: 1,
  id: "marketing-basics",
  title: "Marketing Basics",
  modules: [
    {
      id: "intro",
      type: "story-cards",
      content: {
        cards: [{ title: "Welcome!", body: "Let's learn the fundamentals." }],
      },
    },
    {
      id: "metrics",
      type: "flashcards",
      content: {
        cards: [{ front: "CTR", back: "Click-through rate: clicks ÷ impressions." }],
      },
    },
  ],
});

export default function App() {
  return <LessonPlayer lesson={lesson} onEvent={(e) => console.log(e)} />;
}`;

const jsonExample = `{
  "id": "ctr-check",
  "type": "true-false",
  "title": "Quick check",
  "content": {
    "statements": [
      {
        "text": "A higher CTR always means a more profitable campaign.",
        "isTrue": false,
        "explanation": "CTR measures relevance, not profit. A campaign can have a great CTR and still lose money."
      },
      {
        "text": "ROAS is revenue divided by ad spend.",
        "isTrue": true
      }
    ]
  }
}`;

const categoryPitch: Record<string, string> = {
  learn:
    "Absorb an idea in under a minute: story cards and flashcards that feel like an app, not a slide deck.",
  practice:
    "Check understanding with tactile, keyboard-friendly challenges that explain every answer.",
  explore:
    "Click through dashboards, product tours and workflows — safe simulations of the real thing.",
  decide: "Branching scenarios and chat simulations where every choice has a consequence.",
  simulate:
    "Move the sliders and watch the numbers respond. Intuition for budgets, funnels and trade-offs.",
};

export function HomePage() {
  useTitle("");
  const { mode } = useTheme();
  const [tab, setTab] = useState(0);
  const [category, setCategory] = useState<string>("practice");
  const [copied, setCopied] = useState(false);
  const tabs = heroTabs.filter((t) => getDemo(t.type));
  const current = tabs[tab] ?? tabs[0];
  const demo = current ? getDemo(current.type) : undefined;
  const jsonDemo = useMemo(() => JSON.parse(jsonExample) as { id: string; type: string }, []);
  const inCategory = moduleDocs.filter((m) => m.category === category);
  const total = moduleDocs.length;

  const copyInstall = async () => {
    try {
      await navigator.clipboard.writeText("npm install @nibblearn/react");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden">
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="site-container relative grid grid-cols-1 gap-10 pb-10 pt-14 text-center sm:pt-20">
          <motion.div
            className="min-w-0"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-muted">
              <Sparkles size={14} aria-hidden className="text-brand dark:text-indigo-300" /> Open
              source · MIT · React 18 & 19
            </span>
            <h1 className="display display-blue mx-auto mt-6 max-w-5xl text-[2.9rem] sm:text-7xl lg:text-[6.25rem]">
              Tiny interactions.
              <br />
              <span className="accent-text">Real learning.</span>
            </h1>
            <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[15px] font-medium text-brand dark:text-indigo-200">
              <li className="inline-flex items-center gap-2">
                <MousePointerClick size={18} aria-hidden /> Learn by doing
              </li>
              <li className="inline-flex items-center gap-2">
                <Zap size={18} aria-hidden /> 15–90 second activities
              </li>
              <li className="inline-flex items-center gap-2">
                <Bot size={18} aria-hidden /> Lessons as JSON, AI-ready
              </li>
            </ul>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
              An open-source React library of {total} beautiful, accessible learning modules —
              flashcards, branching scenarios, budget simulators and more. Drop one into a page, or
              let the Lesson Player turn a JSON file into a full course.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/modules" className="btn-blue focus-ring">
                Explore modules <ArrowRight size={16} aria-hidden />
              </Link>
              <Link to="/examples" className="btn-lime focus-ring">
                Play a lesson <ArrowRight size={16} aria-hidden />
              </Link>
              <a href={GITHUB_URL} className="btn-ghost focus-ring">
                <GithubIcon /> GitHub
              </a>
            </div>
            <button
              type="button"
              onClick={copyInstall}
              className="mt-5 inline-flex items-center gap-3 rounded-full border border-line bg-surface px-4 py-2 font-mono text-sm text-muted hover:bg-surface-2 focus-ring"
            >
              <Terminal size={14} aria-hidden />
              <span className="sr-only">Copy: </span>
              npm install @nibblearn/react
              {copied ? (
                <Check size={14} aria-hidden className="text-emerald-600" />
              ) : (
                <Copy size={14} aria-hidden />
              )}
            </button>
          </motion.div>

          {/* Collage: live module in the middle, floating metric cards around it */}
          <motion.div
            className="relative mx-auto w-full min-w-0 max-w-3xl text-left"
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
              <div className="float-card -left-52 top-6 w-44">
                <div className="text-xs text-muted">Lesson score</div>
                <div className="mt-1 font-[family-name:var(--font-display)] text-4xl font-extrabold">
                  92%
                </div>
                <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <TrendingUp size={12} /> +18% after retry
                </div>
              </div>
              <div className="float-card -left-44 top-56 w-40">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">
                  <Flame size={12} /> 5 in a row
                </div>
                <div className="mt-2 text-xs text-muted">Streak bonus unlocked</div>
              </div>
              <div className="float-card -right-52 top-14 w-48">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Events
                </div>
                <ul className="mt-2 space-y-1 font-mono text-[11px]">
                  <li className="text-brand dark:text-indigo-300">module:answer</li>
                  <li className="text-brand dark:text-indigo-300">module:complete</li>
                  <li className="text-muted">lesson:navigate</li>
                </ul>
              </div>
              <div className="float-card -right-40 top-64 w-40">
                <div className="text-xs text-muted">Points</div>
                <div className="mt-1 inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-4xl font-extrabold">
                  <Star size={22} className="text-amber-500" fill="currentColor" /> 340
                </div>
              </div>
            </div>
            <div className="relative rounded-[1.75rem] border border-line bg-[var(--site-bg)] p-2 shadow-[0_40px_90px_-30px_rgba(0,9,220,0.45)]">
              <div className="flex items-center justify-between gap-2 overflow-x-auto px-3 py-2">
                <div className="flex gap-1.5" aria-hidden>
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-sky)]" />
                </div>
                <div
                  className="flex gap-1 rounded-full bg-surface-2 p-1"
                  role="tablist"
                  aria-label="Hero demo"
                >
                  {tabs.map((t, i) => (
                    <button
                      key={t.type}
                      role="tab"
                      aria-selected={i === tab}
                      type="button"
                      onClick={() => setTab(i)}
                      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold focus-ring ${i === tab ? "bg-brand text-white" : "text-muted hover:text-[var(--site-fg)]"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-[1.4rem] bg-surface p-3 sm:p-6">
                <NibblearnProvider theme={mode}>
                  {demo ? (
                    <ModuleRenderer
                      key={`${current!.type}-${tab}`}
                      config={{ ...demo, appearance: { compact: true } } as typeof demo}
                    />
                  ) : (
                    <div className="grid min-h-64 place-items-center text-sm text-muted">
                      Loading demo…
                    </div>
                  )}
                </NibblearnProvider>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------- Lime stats ---------------- */}
      <section className="site-container py-14 sm:py-20" aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="display display-blue text-center text-4xl sm:text-6xl">
          Built like a product.
          <br />
          Free like open source.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              k: String(total),
              v: "Interactive modules",
              d: "Each with its own interaction pattern, one design language.",
            },
            {
              k: "100%",
              v: "Keyboard operable",
              d: "Every drag, swipe and slider has a button alternative.",
            },
            {
              k: "0",
              v: "Trackers by default",
              d: "Progress stays in the browser unless you add an adapter.",
            },
            {
              k: "1",
              v: "JSON file per lesson",
              d: "Validated with readable errors. Easy for humans and AI to write.",
            },
          ].map((s) => (
            <div key={s.v} className="lime-card relative overflow-hidden p-6">
              <div className="font-[family-name:var(--font-display)] text-6xl font-extrabold leading-none tracking-[-0.04em]">
                {s.k}
              </div>
              <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-extrabold">
                {s.v}
              </div>
              <p className="mt-2 text-sm font-medium opacity-80">{s.d}</p>
              <svg
                className="pointer-events-none absolute -bottom-2 right-0 h-20 w-40 opacity-40"
                viewBox="0 0 160 80"
                aria-hidden
              >
                <path
                  d="M0 60 C 30 60, 40 20, 70 20 S 110 50, 160 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <circle cx="70" cy="20" r="3" fill="currentColor" />
                <circle cx="160" cy="10" r="3" fill="currentColor" />
              </svg>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Navy: categories ---------------- */}
      <section className="navy-band py-16 sm:py-24" aria-labelledby="categories-heading">
        <div className="site-container">
          <h2
            id="categories-heading"
            className="display text-center text-4xl text-white sm:text-6xl"
          >
            One library.
            <br />
            Five ways to learn.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-center text-[#c9cbff]">
            Every module shares one design system, one JSON schema style and one completion contract
            — so a lesson can mix them freely.
          </p>
          <div
            className="mt-8 flex flex-wrap justify-center gap-2"
            role="tablist"
            aria-label="Module categories"
          >
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={category === c.id}
                onClick={() => setCategory(c.id)}
                className="pill-dashed rounded-lg px-4 py-2 text-sm font-medium focus-ring"
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-xl text-center text-sm text-[#b3b4cc]">
            {categoryPitch[category]}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inCategory.map((m) => (
              <Link
                key={m.type}
                to={`/modules/${m.type}`}
                className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.07] focus-ring"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-white">
                  <Icon name={m.icon} size={22} aria-hidden />
                </span>
                <span className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.02em]">
                  {m.name}
                </span>
                <span className="text-sm text-[#b3b4cc]">{m.tagline}</span>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-[#a5b4fc]">
                  Open demo{" "}
                  <ArrowRight
                    size={14}
                    aria-hidden
                    className="transition group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Philosophy ---------------- */}
      <section className="site-container grid gap-6 py-14 sm:grid-cols-3 sm:py-20">
        {[
          {
            k: "Interaction first.",
            v: "Learners tap, drag, decide and simulate. Every module is something to do, not something to scroll.",
          },
          {
            k: "Reading second.",
            v: "Short explanations appear exactly when they matter — after a choice, inside a card, next to a mistake.",
          },
          {
            k: "Testing third.",
            v: "Scores come from the activity itself. No bolted-on quiz at the end.",
          },
        ].map((p) => (
          <div key={p.k} className="rounded-2xl border border-line p-6">
            <h2 className="display display-blue text-3xl">{p.k}</h2>
            <p className="mt-2 text-sm text-muted">{p.v}</p>
          </div>
        ))}
      </section>

      {/* ---------------- All modules ---------------- */}
      <section className="site-container pb-16 sm:pb-24">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h2 className="display display-blue text-4xl sm:text-6xl">
            {total} ways to
            <br />
            learn by doing
          </h2>
          <Link to="/modules" className="btn-ghost focus-ring self-start md:self-auto">
            Open the gallery <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {moduleDocs.map((m) => (
            <ModuleCard key={m.type} doc={m} />
          ))}
        </div>
      </section>

      {/* ---------------- JSON / AI ---------------- */}
      <section className="border-y border-line bg-surface">
        <div className="site-container grid items-center gap-12 py-16 lg:grid-cols-2 sm:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-brand dark:text-indigo-300">
              AI-native content
            </p>
            <h2 className="display display-blue mt-3 text-4xl sm:text-6xl">
              Lessons are just JSON
            </h2>
            <p className="mt-4 text-muted">
              Every module has a strict, documented Zod schema. An LLM can turn a training document
              into a complete, valid lesson — and Nibblearn tells you exactly what is wrong when it
              is not.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                { icon: Bot, text: "Ready-made prompt for generating lessons from documents" },
                { icon: Check, text: "Human-readable validation errors with exact JSON paths" },
                { icon: Blocks, text: "Register your own module types in the same registry" },
                {
                  icon: Sparkles,
                  text: "<LessonPlayer /> handles intro, progress, scoring and resume",
                },
              ].map((f) => (
                <li key={f.text} className="flex items-start gap-3">
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-brand text-white">
                    <f.icon size={15} aria-hidden />
                  </span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/docs/ai-content-generation" className="btn-blue focus-ring">
                AI authoring guide <ArrowRight size={16} aria-hidden />
              </Link>
              <Link to="/playground" className="btn-ghost focus-ring">
                Open playground
              </Link>
            </div>
          </div>
          <div className="grid min-w-0 gap-4">
            <CodeBlock lang="json" title="true-false.json" code={jsonExample} />
            <div className="rounded-2xl border border-line bg-[var(--site-bg)] p-4 sm:p-5">
              <NibblearnProvider theme={mode}>
                <ModuleRenderer config={jsonDemo} />
              </NibblearnProvider>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section className="site-container py-16 sm:py-24">
        <h2 className="display display-blue text-4xl sm:text-6xl">
          Everything a library
          <br />
          should bring
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Accessibility,
              t: "Accessible by default",
              d: "WCAG 2.2 AA targets, axe-tested pages, live announcements, visible focus, reduced motion.",
            },
            {
              icon: Palette,
              t: "Themeable with CSS variables",
              d: "Light and deep-navy dark themes. Override accent, radius, fonts and shadows without touching components.",
            },
            {
              icon: Gauge,
              t: "Lightweight",
              d: "One stylesheet, tree-shakeable ESM + CJS, no Tailwind required, no runtime CSS-in-JS.",
            },
            {
              icon: Save,
              t: "Local progress",
              d: "SSR-safe localStorage persistence with resume — or plug in your own storage adapter.",
            },
            {
              icon: Languages,
              t: "Internationalised",
              d: "All UI strings live outside components. English ships built in; translate via `messages`.",
            },
            {
              icon: Blocks,
              t: "Extensible",
              d: "A module registry with Zod schemas lets custom activities validate and play like built-ins.",
            },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-line bg-surface p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand dark:bg-indigo-500/15 dark:text-indigo-300">
                <f.icon size={20} aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Quick start ---------------- */}
      <section className="border-t border-line bg-surface">
        <div className="site-container grid items-start gap-10 py-16 lg:grid-cols-[1fr_1.2fr] sm:py-24">
          <div>
            <h2 className="display display-blue text-4xl sm:text-6xl">
              First lesson in five minutes
            </h2>
            <ol className="mt-6 space-y-4 text-sm">
              {[
                ["Install", "npm install @nibblearn/react"],
                ["Import the stylesheet", 'import "@nibblearn/react/styles.css"'],
                ["Define a lesson", "defineLesson({...}) validates and types it"],
                ["Render", "<LessonPlayer lesson={lesson} />"],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--site-fg)] font-[family-name:var(--font-display)] text-base font-bold text-[var(--site-bg)]">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-semibold">{t}</div>
                    <code className="text-xs text-muted">{d}</code>
                  </div>
                </li>
              ))}
            </ol>
            <Link to="/docs/getting-started" className="btn-ghost mt-8 focus-ring">
              Read the docs <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <div className="min-w-0">
            <CodeBlock lang="tsx" title="App.tsx" code={quickStart} />
          </div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="site-container py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#111114] p-8 text-white sm:p-14">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[var(--color-brand)] opacity-40 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-amber-400 opacity-20 blur-3xl"
            aria-hidden
          />
          <h2 className="display relative text-4xl sm:text-6xl">
            Play the complete
            <br />
            example courses
          </h2>
          <p className="relative mt-4 max-w-xl text-white/85">
            Four onboarding courses for a fictional agency — welcome, campaign launch, client
            communication and marketing metrics — built entirely from Nibblearn JSON.
          </p>
          <Link to="/examples" className="btn-blue relative mt-8 focus-ring">
            Play the examples <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
