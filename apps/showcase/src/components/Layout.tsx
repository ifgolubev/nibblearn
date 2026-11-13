import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { Menu, Moon, Sun, X } from "lucide-react";

export function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}
import { useTheme } from "@/lib/theme";

const nav = [
  { to: "/modules", label: "Modules" },
  { to: "/examples", label: "Examples" },
  { to: "/playground", label: "Playground" },
  { to: "/docs", label: "Docs" },
];

export const GITHUB_URL = "https://github.com/ifgolubev/nibblearn";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-[1.4rem] font-extrabold leading-none tracking-[-0.03em] text-[var(--site-fg)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--site-fg)] text-[var(--site-bg)]">
        <svg viewBox="0 0 64 64" width="18" height="18" aria-hidden>
          <path d="M17 46V18h7.5L39 35.5V18h7.5v28H39L24.5 28.5V46z" fill="currentColor" />
          <circle cx="49" cy="15" r="5" fill="#f59e0b" />
        </svg>
      </span>
      Nibblearn
    </span>
  );
}

export function Layout() {
  const { mode, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_srgb,var(--site-bg)_85%,transparent)] backdrop-blur">
        <div className="site-container flex h-16 items-center justify-between gap-4">
          <Link to="/" className="focus-ring">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium focus-ring ${isActive ? "bg-surface-2 text-[var(--site-fg)]" : "text-muted hover:bg-surface-2 hover:text-[var(--site-fg)]"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface-2 focus-ring sm:inline-flex"
            >
              <GithubIcon /> GitHub
            </a>
            <Link
              to="/docs/getting-started"
              className="hidden h-10 items-center rounded-full bg-[var(--site-fg)] px-4 text-sm font-semibold text-[var(--site-bg)] transition active:scale-[0.97] focus-ring sm:inline-flex"
            >
              Get started
            </Link>
            <button
              type="button"
              onClick={toggle}
              className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 focus-ring"
              aria-label={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {mode === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
            </button>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 focus-ring md:hidden"
              aria-label="Toggle menu"
              aria-expanded={open}
            >
              {open ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
            </button>
          </div>
        </div>
        {open && (
          <nav
            className="site-container flex flex-col gap-1 border-t border-line py-3 md:hidden"
            aria-label="Mobile"
          >
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface-2 focus-ring"
              >
                {n.label}
              </NavLink>
            ))}
            <a
              href={GITHUB_URL}
              className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface-2 focus-ring"
            >
              GitHub
            </a>
          </nav>
        )}
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line py-10">
        <div className="site-container flex flex-col gap-6 text-sm text-muted md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <Logo className="text-[var(--site-fg)]" />
            <p>
              Tiny interactions. Real learning. Open-source learning components for React, MIT
              licensed.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link to="/docs" className="hover:text-[var(--site-fg)]">
              Documentation
            </Link>
            <Link to="/modules" className="hover:text-[var(--site-fg)]">
              Modules
            </Link>
            <Link to="/playground" className="hover:text-[var(--site-fg)]">
              Playground
            </Link>
            <a href={GITHUB_URL} className="hover:text-[var(--site-fg)]">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
