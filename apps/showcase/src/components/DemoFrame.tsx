import { useState, type ReactNode } from "react";
import { Moon, RotateCcw, Sun } from "lucide-react";
import { NibblearnProvider } from "@nibblearn/react";
import { useTheme } from "@/lib/theme";

export interface DemoFrameProps {
  children: (resetKey: number) => ReactNode;
  /** Allow toggling the module theme independently from the site. */
  themeToggle?: boolean;
  plain?: boolean;
  className?: string;
  label?: string;
}

/** Frame for live demos with reset and theme controls. */
export function DemoFrame({
  children,
  themeToggle = true,
  plain,
  className,
  label,
}: DemoFrameProps) {
  const site = useTheme();
  const [override, setOverride] = useState<"light" | "dark" | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const mode = override ?? site.mode;
  return (
    <div
      className={["demo-frame", plain && "demo-frame--plain", className].filter(Boolean).join(" ")}
      data-demo-theme={mode}
    >
      <div className="demo-frame__toolbar">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          {label ?? "Live demo"}
        </span>
        <div className="flex items-center gap-1">
          {themeToggle && (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2 focus-ring"
              onClick={() => setOverride(mode === "dark" ? "light" : "dark")}
              aria-label={mode === "dark" ? "Preview in light mode" : "Preview in dark mode"}
            >
              {mode === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
              <span className="hidden sm:inline">{mode === "dark" ? "Light" : "Dark"}</span>
            </button>
          )}
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2 focus-ring"
            onClick={() => setResetKey((k) => k + 1)}
          >
            <RotateCcw size={16} aria-hidden />
            Reset
          </button>
        </div>
      </div>
      <NibblearnProvider theme={mode} key={mode}>
        <div
          className={
            mode === "dark"
              ? "dark rounded-2xl bg-[#0c0c0f] p-3 sm:p-5"
              : "rounded-2xl bg-white p-3 sm:p-5 border border-line"
          }
        >
          {children(resetKey)}
        </div>
      </NibblearnProvider>
    </div>
  );
}
