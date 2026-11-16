import { describe, expect, it } from "vitest";
import { isSafeLinkHref, parseBlocks, parseInlineMarkup, stripMarkup } from "../src";

describe("links", () => {
  it("parses safe links inside text", () => {
    expect(
      parseInlineMarkup("See [the guide](https://example.com/a?b=1) and [help](/help)."),
    ).toEqual([
      { kind: "text", value: "See " },
      { kind: "link", value: "the guide", href: "https://example.com/a?b=1" },
      { kind: "text", value: " and " },
      { kind: "link", value: "help", href: "/help" },
      { kind: "text", value: "." },
    ]);
    expect(parseInlineMarkup("[mail](mailto:team@example.com)")[0]).toMatchObject({ kind: "link" });
    expect(parseInlineMarkup("[call](tel:+4912345)")[0]).toMatchObject({ kind: "link" });
    expect(parseInlineMarkup("[top](#intro)")[0]).toMatchObject({ kind: "link" });
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<b>x</b>",
    "vbscript:msgbox(1)",
    "//evil.example",
    "/\\evil.example",
    " https://example.com",
    "\thttps://example.com",
    "java\nscript:alert(1)",
    "https://",
    "ftp://example.com",
    "file:///etc/passwd",
  ])("never links %j", (href) => {
    expect(isSafeLinkHref(href)).toBe(false);
    const tokens = parseInlineMarkup(`[x](${href})`);
    expect(tokens.some((t) => t.kind === "link")).toBe(false);
  });

  it("keeps unsafe link markup as plain text", () => {
    expect(stripMarkup("[x](javascript:alert(1))")).toContain("javascript:");
    expect(stripMarkup("Read [this](https://example.com)")).toBe("Read this");
  });

  it("still supports the other inline markup", () => {
    expect(parseInlineMarkup("**b** *i* `c`").map((t) => t.kind)).toEqual([
      "bold",
      "text",
      "italic",
      "text",
      "code",
    ]);
  });
});

describe("parseBlocks", () => {
  it("splits paragraphs and lists", () => {
    expect(
      parseBlocks("Intro line.\n\n- one\n- two\ncontinued\n\n1. first\n2) second\n\nEnd."),
    ).toEqual([
      { kind: "paragraph", text: "Intro line." },
      { kind: "list", ordered: false, items: ["one", "two\ncontinued"] },
      { kind: "list", ordered: true, items: ["first", "second"] },
      { kind: "paragraph", text: "End." },
    ]);
  });

  it("handles a list right after text in the same paragraph", () => {
    expect(parseBlocks("Steps:\n- a\n- b")).toEqual([
      { kind: "paragraph", text: "Steps:" },
      { kind: "list", ordered: false, items: ["a", "b"] },
    ]);
  });

  it("does not treat inline asterisks or numbers as lists", () => {
    expect(parseBlocks("Spend *wisely*.\n2026 was a good year.")).toEqual([
      { kind: "paragraph", text: "Spend *wisely*.\n2026 was a good year." },
    ]);
  });
});

describe("untrusted text stays fast and keeps its structure", () => {
  const time = (fn: () => void) => {
    const t0 = performance.now();
    fn();
    return performance.now() - t0;
  };

  it("parses adversarial input in linear time", () => {
    expect(time(() => parseInlineMarkup("[".repeat(20_000)))).toBeLessThan(500);
    expect(time(() => parseInlineMarkup(`[x](${"(".repeat(20_000)}`))).toBeLessThan(500);
    expect(time(() => parseBlocks(`- ${" ".repeat(19_990)}x\r\ny`))).toBeLessThan(500);
    expect(time(() => parseBlocks(`1. ${" ".repeat(19_990)}\u2028x`))).toBeLessThan(500);
  });

  it("reads CRLF text like LF text", () => {
    expect(parseBlocks("Steps:\r\n- one\r\n- two\r\n- three")).toEqual(
      parseBlocks("Steps:\n- one\n- two\n- three"),
    );
    expect(parseBlocks("a\r\n\r\nb")).toEqual([
      { kind: "paragraph", text: "a" },
      { kind: "paragraph", text: "b" },
    ]);
  });

  it("keeps the author's list numbers", () => {
    expect(parseBlocks("1. Draft\n\n2. Share\n\n3. Book")).toEqual([
      { kind: "list", ordered: true, items: ["Draft"] },
      { kind: "list", ordered: true, items: ["Share"], start: 2 },
      { kind: "list", ordered: true, items: ["Book"], start: 3 },
    ]);
  });
});
