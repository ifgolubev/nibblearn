import { Fragment, useMemo } from "react";
import { parseInlineMarkup, splitParagraphs } from "@nibblearn/core";
import clsx from "clsx";

export interface RichTextProps {
  /** Text with optional **bold**, *italic*, `code` and line breaks. Blank lines create paragraphs. */
  text: string;
  /** Render as paragraphs (blank-line separated). Default: inline. */
  paragraphs?: boolean;
  className?: string;
  as?: "span" | "div" | "p";
}

function Inline({ text }: { text: string }) {
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
    const paras = splitParagraphs(text);
    return (
      <div className={clsx("nb-rich", className)}>
        {paras.map((p, i) => (
          <p key={i}>
            <Inline text={p} />
          </p>
        ))}
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
