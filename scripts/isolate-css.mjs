// Writes <dir>/styles.isolated.css from <dir>/styles.css: the same rules, each selector raised
// by one id's worth of specificity (`:not(#\#)` matches every element). Styles of the host
// page written with element, class and attribute selectors can then no longer override
// Nibblearn's, wherever the two stylesheets are loaded. Used when modules sit inside page
// content that has its own typography (articles, CMS output, rich-text editors).
// Token definitions (`--nb-*`) keep their specificity: themes keep working unchanged.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import postcss from "postcss";

const BOOST = ":not(#\\#)";
// A pseudo-element (with any pseudo-classes after it) must stay at the end of its selector.
const PSEUDO_ELEMENT_TAIL =
  /(?:::[a-zA-Z-]+(?:\([^()]*\))?|:(?:before|after))(?::[a-zA-Z-]+(?:\([^()]*\))?)*$/;

/** `.nb-btn:hover::before` → `.nb-btn:hover:not(#\#)::before`. */
export function boostSelector(selector) {
  const s = selector.trim();
  const tail = PSEUDO_ELEMENT_TAIL.exec(s);
  return tail ? s.slice(0, tail.index) + BOOST + tail[0] : s + BOOST;
}

export function isolateCss(css) {
  const root = postcss.parse(css);
  root.walkRules((rule) => {
    // Keyframe steps (`from`, `50%`) are not selectors.
    if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
    // Token definitions keep their specificity, so a theme written as
    // `.nb-root { --nb-accent: … }` overrides them exactly as with the regular stylesheet.
    // A rule that mixes tokens with other declarations is split in two.
    const isToken = (n) => n.type === "decl" && n.prop.startsWith("--");
    const decls = rule.nodes.filter((n) => n.type === "decl");
    const tokens = decls.filter(isToken);
    if (decls.length > 0 && tokens.length === decls.length) return;
    if (tokens.length > 0) {
      const tokenRule = rule.clone();
      tokenRule.walkDecls((d) => {
        if (!isToken(d)) d.remove();
      });
      rule.before(tokenRule);
      for (const d of tokens) d.remove();
    }
    rule.selectors = rule.selectors.map(boostSelector);
  });
  return root.toString();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] ?? "dist";
  const out = isolateCss(readFileSync(join(dir, "styles.css"), "utf8"));
  writeFileSync(join(dir, "styles.isolated.css"), out);
}
