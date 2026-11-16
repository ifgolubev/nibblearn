import { createContext, Fragment, useContext, useMemo, type ReactNode } from "react";
import { parseBlocks, parseInlineMarkup } from "@nibblearn/core";
import { useTranslator } from "../context/NibblearnProvider";
import clsx from "clsx";

export interface RichTextProps {
  /**
   * Text with optional **bold**, *italic*, `code`, [links](https://…) and line breaks. With
   * `paragraphs`, blank lines create paragraphs and lines starting with "- " or "1. " lists.
   */
  text: string;
  /** Render as paragraphs (blank-line separated). Default: inline. */
  paragraphs?: boolean;
  className?: string;
  as?: "span" | "div" | "p";
}

/** False inside interactive elements (buttons, options, cards): links render as plain text. */
const LinksContext = createContext(true);

/**
 * Wrap the content of an interactive element (a button, an option, a flip card) in this, so
 * `[label](url)` in its text renders as the label only and never nests a link in a control.
 */
export function NoLinks({ children }: { children: ReactNode }) {
  return <LinksContext.Provider value={false}>{children}</LinksContext.Provider>;
}

function Inline({ text }: { text: string }) {
  const t = useTranslator();
  const links = useContext(LinksContext);
  const tokens = useMemo(() => parseInlineMarkup(text), [text]);
  return (
    <>
      {tokens.map((tk, i) => {
        switch (tk.kind) {
          case "bold":
            return <strong key={i}>{tk.value}</strong>;
          case "italic":
            return <em key={i}>{tk.value}</em>;
          case "code":
            return <code key={i}>{tk.value}</code>;
          case "link": {
            if (!links) return <Fragment key={i}>{tk.value}</Fragment>;
            const external = /^https?:/i.test(tk.href);
            return (
              <a
                key={i}
                href={tk.href}
                rel="noopener noreferrer"
                target={external ? "_blank" : undefined}
              >
                {tk.value}
                {external && <span className="nb-sr-only"> {t("common.opensInNewTab")}</span>}
              </a>
            );
          }
          case "break":
            return <br key={i} />;
          default:
            return <Fragment key={i}>{tk.value}</Fragment>;
        }
      })}
    </>
  );
}

/** Safe rich text: never injects HTML. */
export function RichText({ text, paragraphs = false, className, as = "span" }: RichTextProps) {
  if (paragraphs) {
    const blocks = parseBlocks(text);
    return (
      <div className={clsx("nb-rich", className)}>
        {blocks.map((b, i) => {
          if (b.kind === "paragraph")
            return (
              <p key={i}>
                <Inline text={b.text} />
              </p>
            );
          const List = b.ordered ? "ol" : "ul";
          return (
            <List key={i} start={b.ordered ? b.start : undefined}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inline text={item} />
                </li>
              ))}
            </List>
          );
        })}
      </div>
    );
  }
  const Tag = as;
  return (
    <Tag className={clsx("nb-rich", className)}>
      <Inline text={text} />
    </Tag>
  );
}
