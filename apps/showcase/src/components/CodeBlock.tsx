import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { HighlighterCore } from "shiki/core";

type Highlighter = HighlighterCore;

const LANG_ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
};
const SUPPORTED = new Set([
  "tsx",
  "typescript",
  "javascript",
  "jsx",
  "json",
  "bash",
  "css",
  "html",
  "yaml",
]);

let highlighterPromise: Promise<Highlighter> | null = null;
const cache = new Map<string, string>();

/**
 * Fine-grained shiki: only the grammars and theme we use, with the JavaScript regex
 * engine (no WASM). Loaded lazily on the first code block.
 */
function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
    ]);
    return createHighlighterCore({
      themes: [import("shiki/themes/github-dark-default.mjs")],
      langs: [
        import("shiki/langs/tsx.mjs"),
        import("shiki/langs/typescript.mjs"),
        import("shiki/langs/javascript.mjs"),
        import("shiki/langs/jsx.mjs"),
        import("shiki/langs/json.mjs"),
        import("shiki/langs/bash.mjs"),
        import("shiki/langs/css.mjs"),
        import("shiki/langs/html.mjs"),
        import("shiki/langs/yaml.mjs"),
      ],
      engine: createJavaScriptRegexEngine(),
    });
  })();
  return highlighterPromise;
}

async function highlight(code: string, rawLang: string): Promise<string | null> {
  const lang = LANG_ALIASES[rawLang] ?? rawLang;
  if (!SUPPORTED.has(lang)) return null;
  const key = `${lang}:${code}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const highlighter = await getHighlighter();
  const html = highlighter.codeToHtml(code, { lang, theme: "github-dark-default" });
  cache.set(key, html);
  return html;
}

export function CodeBlock({
  code,
  lang = "tsx",
  title,
  className,
  collapsible = false,
}: {
  code: string;
  lang?: string;
  title?: string;
  className?: string;
  /** Collapse long blocks with an expand button. */
  collapsible?: boolean;
}) {
  const [html, setHtml] = useState<string | null>(() => cache.get(`${lang}:${code}`) ?? null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const long = collapsible && code.split("\n").length > 26;
  useEffect(() => {
    let active = true;
    highlight(code, lang)
      .then((h) => active && setHtml(h))
      .catch(() => active && setHtml(null));
    return () => {
      active = false;
    };
  }, [code, lang]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={["code-block", className].filter(Boolean).join(" ")}>
      <div className="code-block__bar">
        <span>{title ?? lang}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white focus-ring"
          aria-label="Copy code"
        >
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className={long && !expanded ? "code-block__clip" : undefined}>
        {html ? (
          // Shiki output is generated locally from our own trusted strings, never from user input.
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre tabIndex={0}>
            <code className="text-[#e6edf3]">{code}</code>
          </pre>
        )}
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="code-block__expand"
          aria-expanded={expanded}
        >
          {expanded ? "Collapse" : `Show all ${code.split("\n").length} lines`}
        </button>
      )}
    </div>
  );
}
